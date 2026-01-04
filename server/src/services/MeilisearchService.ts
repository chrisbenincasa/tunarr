import { nullToUndefined, seq } from '@tunarr/shared/util';
import {
  FindChild,
  tag,
  Tag,
  TerminalProgram,
  TupleToUnion,
} from '@tunarr/types';
import { SearchFilter, StringOperators } from '@tunarr/types/api';
import {
  ExternalIdType,
  isValidMultiExternalIdType,
  isValidSingleExternalIdType,
} from '@tunarr/types/schemas';
import { Mutex } from 'async-mutex';
import retry from 'async-retry';
import base32 from 'base32';
import dayjs from 'dayjs';
import type { ProcessInfo } from 'find-process';
import findProcess from 'find-process';
import { inject, injectable } from 'inversify';
import { compact, find, isEmpty, isNull, isString } from 'lodash-es';
import {
  DocumentsQuery,
  EnqueuedTask,
  FacetDistribution,
  FacetStats,
  MeiliSearch,
  MeiliSearchApiError,
  ResourceResults,
  SearchParams,
  Settings,
  Task,
} from 'meilisearch';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { isMainThread } from 'node:worker_threads';
import { MarkRequired, Paths } from 'ts-essentials';
import { match, P } from 'ts-pattern';
import serverPackage from '../../package.json' with { type: 'json' };
import { ISettingsDB } from '../db/interfaces/ISettingsDB.ts';
import { ProgramState } from '../db/schema/base.ts';
import { ProgramType } from '../db/schema/Program.ts';
import { ProgramGroupingType } from '../db/schema/ProgramGrouping.ts';
import { ServerOptions } from '../globals.ts';
import { KEYS } from '../types/inject.ts';
import {
  AlbumWithArtist,
  Episode,
  EpisodeWithAncestors2,
  HasMediaSourceAndLibraryId,
  MediaSourceEpisode,
  MediaSourceMusicAlbum,
  MediaSourceMusicTrack,
  MediaSourceSeason,
  Movie,
  MusicAlbum,
  MusicArtist,
  MusicTrack,
  MusicTrackWithAncestors,
  OtherVideo,
  Season,
  SeasonWithShow,
  Show,
} from '../types/Media.ts';
import { Path } from '../types/path.ts';
import { Result } from '../types/result.ts';
import { Maybe, Nilable, Nullable } from '../types/util.ts';
import {
  ChildProcessHelper,
  ChildProcessWrapper,
} from '../util/ChildProcessHelper.ts';
import {
  getBooleanEnvVar,
  getEnvVar,
  getNumericEnvVar,
  TUNARR_ENV_VARS,
} from '../util/env.ts';
import { fileExists } from '../util/fsUtil.ts';
import { isNonEmptyString, isWindows, wait } from '../util/index.ts';
import { Logger } from '../util/logging/LoggerFactory.ts';
import { FileSystemService } from './FileSystemService.ts';
import { ISearchService } from './ISearchService.ts';

type FlattenArrayTypes<T> = {
  [K in keyof T]-?: Exclude<T[K], undefined> extends Array<unknown>
    ? Exclude<T[K], undefined>[0]
    : T[K];
};

interface BaseDocument {
  id: string;
}

interface TunarrSearchIndex<Type extends BaseDocument> {
  name: string;
  primaryKey: string;
  filterable: Paths<FlattenArrayTypes<Type>>[];
  sortable: Paths<FlattenArrayTypes<Type>>[];
  caseSensitiveFilters?: Path<FlattenArrayTypes<Type>>[];
}

type SingleCaseString = Tag<string, 'caseSensitiveString'>;

type GenericTunarrSearchIndex = {
  name: string;
  primaryKey: string;
  filterable: string[];
  sortable: string[];
  caseSensitiveFilters?: string[];
};

const ProgramsIndex: TunarrSearchIndex<ProgramSearchDocument> = {
  name: 'programs' as const,
  primaryKey: 'id',
  filterable: [
    'duration',
    'externalIds.source',
    'externalIds.sourceId',
    'externalIds.id',
    'title',
    'type',
    'genres.name',
    'actors.name',
    'director.name',
    'writer.name',
    'rating',
    'originalReleaseDate',
    'originalReleaseYear',
    'externalIdsMerged',
    'grandparent.id',
    'grandparent.type',
    'grandparent.title',
    'grandparent.externalIdsMerged',
    'grandparent.tags',
    'grandparent.studio',
    'grandparent.genres',
    'grandparent.rating',
    'parent.id',
    'parent.type',
    'parent.title',
    'parent.externalIdsMerged',
    'parent.genres',
    'parent.studio',
    'parent.tags',
    'parent.rating',
    'mediaSourceId',
    'libraryId',
    'tags',
    'videoBitDepth',
    'videoCodec',
    'videoDynamicRange',
    'videoHeight',
    'videoWidth',
    'audioChannels',
    'audioCodec',
    'state',
    'studio.name',
    'parent.studio',
    'grandparent.studio',
  ],
  sortable: [
    'title',
    'duration',
    'originalReleaseDate',
    'originalReleaseYear',
    'index',
  ],
  caseSensitiveFilters: [
    'grandparent.id',
    'parent.id',
    'libraryId',
    'mediaSourceId',
    'externalIds.sourceId',
  ],
} satisfies TunarrSearchIndex<ProgramSearchDocument>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const AllIndexes = [ProgramsIndex] as const;

const IndexesByName = {
  programs: ProgramsIndex,
} as const satisfies Record<
  TupleToUnion<typeof AllIndexes>['name'],
  GenericTunarrSearchIndex
>;

type IndexTypeByName<IndexName extends keyof typeof IndexesByName> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (typeof IndexesByName)[IndexName] extends TunarrSearchIndex<any>
    ? (typeof IndexesByName)[IndexName]
    : never;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IndexDocumentType<IndexTypeT extends TunarrSearchIndex<any>> =
  IndexTypeT extends TunarrSearchIndex<infer DocumentType>
    ? DocumentType
    : never;

type IndexDocumentTypeByName<IndexName extends keyof typeof IndexesByName> =
  (typeof IndexesByName)[IndexName] extends TunarrSearchIndex<
    infer IndexInferred
  >
    ? IndexInferred extends Record<string, unknown>
      ? IndexInferred
      : Record<string, unknown>
    : Record<string, unknown>;

type ExternalIdSubDoc = {
  id: string;
  source: ExternalIdType;
  sourceId?: SingleCaseString;
};

type MergedExternalId = `${ExternalIdType}|${string}|${string}`;
type MergedGroupingExternalId<GroupingType extends ProgramGroupingType> =
  `${GroupingType}_${MergedExternalId}`;

type ProgramGroupingDenormDocument<GroupingType extends ProgramGroupingType> = {
  id: SingleCaseString;
  type: GroupingType;
  title: string;
  index?: number;
  year?: number;
  externalIds: ExternalIdSubDoc[];
  externalIdsMerged: MergedGroupingExternalId<GroupingType>[];
  genres: string[];
  tags: string[];
  studio: string[];
  rating?: string;
};

type ProgramParentTypeLookup = [
  [typeof ProgramType.Episode, typeof ProgramGroupingType.Season],
  [typeof ProgramType.Track, typeof ProgramGroupingType.Album],
  [typeof ProgramGroupingType.Season, typeof ProgramGroupingType.Show],
  [typeof ProgramGroupingType.Album, typeof ProgramGroupingType.Artist],
];

type StringName = {
  name: string;
};

type Actor = StringName;
type Writer = StringName;
type Director = StringName;
type Studio = StringName;

type BaseProgramSearchDocument = {
  id: string;
  externalIds: ExternalIdSubDoc[];
  externalIdsMerged: MergedExternalId[];
  mediaSourceId: SingleCaseString;
  libraryId: SingleCaseString;
  title: string;
  titleReverse: string;
  rating: Nullable<string>;
  summary: Nullable<string>;
  plot: Nullable<string>;
  tagline: Nullable<string>;
  originalReleaseDate: Nullable<number>;
  originalReleaseYear: Nullable<number>;
  index?: number;
  genres: StringName[];
  actors: Actor[];
  writer: Writer[];
  director: Director[];
  studio?: Studio[];
  tags: string[];
};

export type TerminalProgramSearchDocument<
  Type extends ProgramType = ProgramType,
> = BaseProgramSearchDocument & {
  type: Type;

  duration: number;

  parent?: ProgramGroupingDenormDocument<
    FindChild<Type, ProgramParentTypeLookup>
  >;
  grandparent?: ProgramGroupingDenormDocument<
    FindChild<FindChild<Type, ProgramParentTypeLookup>, ProgramParentTypeLookup>
  >;

  // Stream details
  videoCodec?: string;
  videoBitDepth?: number;
  videoDynamicRange?: 'sdr' | 'hdr';
  videoHeight?: number;
  videoWidth?: number;
  audioCodec?: string;
  audioChannels?: number;
  state: ProgramState;
};

export type ProgramSearchDocument =
  | TerminalProgramSearchDocument
  | ProgramGroupingSearchDocument;

export type ProgramGroupingSearchDocument<
  Type extends ProgramGroupingType = ProgramGroupingType,
> = BaseProgramSearchDocument & {
  type: Type;
  parent?: ProgramGroupingDenormDocument<
    FindChild<Type, ProgramParentTypeLookup>
  >;
  grandparent?: ProgramGroupingDenormDocument<
    FindChild<FindChild<Type, ProgramParentTypeLookup>, ProgramParentTypeLookup>
  >;
};

export type ProgramGroupingDocumentTypes = {
  [K in ProgramGroupingType]: ProgramGroupingSearchDocument<K>;
};

type SearchRequest<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TargetIndex extends TunarrSearchIndex<any>,
  DocumentType extends Record<string, unknown> = IndexDocumentType<TargetIndex>,
> = {
  //TODO  Make these typesafe against the target index.
  query?: string | null;
  filter?: SearchFilter | null;
  restrictSearchTo?: Path<DocumentType>[];
  facets?: TargetIndex['filterable'][number][] | null;
  mediaSourceId?: string | null;
  libraryId?: string | null;
  paging: {
    page: number;
    limit: number;
  };
};

export type FreeSearchResponse<DocumentType extends Record<string, unknown>> = {
  type: 'search';
  results: DocumentType[];
  facetDistribution?: FacetDistribution;
  facetStats?: FacetStats;
  totalHits: number;
  hitsPerPage: number;
  page: number;
  totalPages: number;
};

export type FilterResponse<DocumentType extends Record<string, unknown>> = {
  type: 'filter';
  results: DocumentType[];
  limit?: number;
  offset?: number;
  total: number;
};

export type SearchResponse<DocumentType extends Record<string, unknown>> =
  | FreeSearchResponse<DocumentType>
  | FilterResponse<DocumentType>;

export type FacetSearchRequest = {
  facetName: string;
  facetQuery?: string;
  filter?: SearchFilter;
  mediaSourceId?: string;
  libraryId?: string;
};

@injectable()
export class MeilisearchService implements ISearchService {
  private mutex = new Mutex();
  private started = false;
  private proc?: ChildProcessWrapper;
  private port: number;
  #client: MeiliSearch;

  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(KEYS.ServerOptions) private serverOptions: ServerOptions,
    @inject(KEYS.SettingsDB) private settingsDB: ISettingsDB,
    @inject(ChildProcessHelper) private childProcessHelper: ChildProcessHelper,
    @inject(FileSystemService) private fileSystemService: FileSystemService,
  ) {}

  getPort() {
    return this.port;
  }

  async start() {
    return await this.mutex.runExclusive(async () => {
      if (this.started) {
        return;
      }

      // Check for update.
      // Only run updates on start of the main tunarr thread
      if ((await fileExists(this.dbPath)) && isMainThread) {
        const indexVersion = await this.getMeilisearchVersion();

        if (indexVersion === serverPackage.meilisearch.version) {
          this.logger.debug(
            'Index version matches package version. No update necessary',
          );
        } else {
          // TODO: Do snapshot and migrate search server
        }
      }

      this.port =
        getNumericEnvVar(TUNARR_ENV_VARS.SEARCH_PORT) ??
        this.serverOptions.searchPort ??
        (await getAvailablePort());

      // Main thread in charge
      if (isMainThread) {
        this.logger.info('Starting Meilisearch service...');

        const processInfo: ProcessInfo[] = await findProcess.default(
          'port',
          this.port,
        );

        // There should really only be one, but OK.
        if (processInfo.length > 0 && processInfo[0]!.name === 'meilisearch') {
          const matchingProcess = processInfo[0]!;
          this.logger.debug(
            'Killing existing Meilisearch service on port %d',
            this.port,
          );
          process.kill(matchingProcess.pid);

          await retry(async () => {
            const results = await findProcess.default(
              'pid',
              matchingProcess.pid,
            );
            if (results.length > 0) {
              throw new Error('Meilisearch process is not dead yet...');
            }
          });
        }

        const args = [
          '--http-addr',
          `localhost:${this.port}`,
          '--db-path',
          `${this.dbPath}`,
          '--no-analytics',
          '--experimental-dumpless-upgrade',
        ];

        const indexingRamSetting =
          getEnvVar(TUNARR_ENV_VARS.SEARCH_MAX_RAM) ??
          this.settingsDB.systemSettings().server.searchSettings
            .maxIndexingMemory;
        if (indexingRamSetting) {
          args.push('--max-indexing-memory', `${indexingRamSetting}`);
        }

        const indexingMaxThreads = getNumericEnvVar(
          TUNARR_ENV_VARS.SEARCH_MAX_INDEXING_THREADS,
        );
        if (indexingMaxThreads) {
          args.push('--max-indexing-threads', indexingMaxThreads.toString());
        }

        args.push(
          '--schedule-snapshot',
          dayjs
            .duration({
              hours:
                this.settingsDB.systemSettings().server.searchSettings
                  .snapshotIntervalHours,
            })
            .asMinutes()
            .toFixed(0),
          '--snapshot-dir',
          this.fileSystemService.getMsSnapshotsPath(),
        );

        if (
          !isWindows() &&
          getBooleanEnvVar(
            TUNARR_ENV_VARS.DEBUG__REDUCE_SEARCH_INDEXING_MEMORY,
            os.platform() === 'linux',
          )
        ) {
          args.push('--experimental-reduce-indexing-memory-usage');
        }

        const searchServerLogFile = path.join(
          this.settingsDB.systemSettings().logging.logsDirectory,
          'meilisearch.log',
        );

        if (await fileExists(searchServerLogFile)) {
          await fs.truncate(searchServerLogFile);
        }

        let executablePath: Maybe<string>;
        // Support the following filenames:
        // 1. meilisearch-{platform}-{arch}(.exe)?
        // 2. meilisearch(.exe)?
        // Then search for these names against these paths:
        // 1. the env var value
        // 2. cwd / bin / bin_name (docker, etc)
        // 3. cwd / bin_name (macOS bundle)
        const baseNames = [
          `meilisearch-${os.platform()}-${os.arch()}`,
          'meilisearch',
        ];
        const binaryNames = baseNames.map((n) =>
          os.platform() === 'win32' ? `${n}.exe` : n,
        );
        const envPath = getEnvVar(TUNARR_ENV_VARS.MEILISEARCH_PATH);
        const testPaths = binaryNames.flatMap((binaryName) => [
          envPath,
          isNonEmptyString(envPath) ? path.join(envPath, binaryName) : null,
          path.join(process.cwd(), 'bin', binaryName),
          path.join(process.cwd(), binaryName),
        ]);
        for (const testPath of testPaths) {
          if (!testPath) {
            continue;
          }

          if (await fileExists(testPath)) {
            executablePath = testPath;
            break;
          }
        }

        if (!isNonEmptyString(executablePath)) {
          throw new Error(
            `Could not find meilisearch binary at any of the tested paths: ${compact(testPaths).join(', ')}`,
          );
        }

        this.proc = await this.childProcessHelper.spawn(executablePath, args, {
          maxAttempts: 3,
          additionalOpts: {
            cwd: this.serverOptions.databaseDirectory,
          },
        });
        this.logger.info('Meilisearch service started on port %d', this.port);
        const outStream = createWriteStream(searchServerLogFile);
        this.proc.process?.stdout.pipe(outStream);
        this.proc.process?.stderr.pipe(outStream);
      }

      this.started = true;

      const client = this.client();
      await retry(async () => {
        const result = await client.health();
        this.logger.debug('Got health result from Meilisearch: %O', result);
      });

      return;
    });
  }

  async restart() {
    // TODO: implement
  }

  stop() {
    this.proc?.kill();
  }

  async getMeilisearchVersion(): Promise<Maybe<string>> {
    const versionPath = path.join(this.dbPath, 'VERSION');
    return fs
      .readFile(versionPath)
      .then((buf) => {
        const version = buf.toString('utf-8').trim();
        this.logger.debug('Found Meilisearch index at version: %s', version);
        return version;
      })
      .catch((e) => {
        this.logger.debug(
          e,
          'Did not find existing Meilisearch VERSION file at %s',
          versionPath,
        );
        return undefined;
      });
  }

  client() {
    if (!this.started) {
      throw new Error('Service was not started yet');
    }
    if (!this.#client) {
      this.#client = new MeiliSearch({ host: `http://localhost:${this.port}` });
    }

    return this.#client;
  }

  async sync() {
    await this.client().httpRequest.patch({
      path: '/experimental-features',
      body: {
        containsFilter: true,
      },
    });

    const existingIndexes = await this.client().getIndexes();

    const processes: Promise<void>[] = [];

    // Programs index
    const existingProgramsIndex = existingIndexes.results.find(
      (index) => index.uid === ProgramsIndex.name,
    );

    if (existingProgramsIndex) {
      this.logger.debug(
        'Programs index already exists. Ensuring it is up-to-date',
      );

      processes.push(this.syncIndexSettings(ProgramsIndex));
    } else {
      this.logger.debug('Creating programs index');
      const task = await this.client().createIndex(ProgramsIndex.name, {
        primaryKey: ProgramsIndex.primaryKey,
      });

      processes.push(
        this.waitForTaskResult(task.taskUid).then(() =>
          this.syncIndexSettings(ProgramsIndex),
        ),
      );
    }

    await Promise.all(processes);
  }

  async getProgram(id: string) {
    try {
      return await this.#client
        .index<ProgramSearchDocument>(ProgramsIndex.name)
        .getDocument(id);
    } catch (e) {
      if (e instanceof MeiliSearchApiError && e.response.status === 404) {
        return Promise.resolve(undefined);
      }
      throw e;
    }
  }

  async getPrograms(ids: string[]): Promise<ProgramSearchDocument[]> {
    try {
      if (ids.length === 0) {
        return [];
      }

      const results: ProgramSearchDocument[] = [];
      let res: ResourceResults<ProgramSearchDocument[]>;
      let offset = 0;
      do {
        res = await this.#client
          .index<ProgramSearchDocument>(ProgramsIndex.name)
          .getDocuments({
            ids,
            offset,
            limit: 100,
          });
        results.push(...res.results);
        offset += res.results.length;
      } while (results.length < res.total || res.results.length > 0);

      return results;
    } catch (e) {
      if (e instanceof MeiliSearchApiError && e.response.status === 404) {
        return Promise.resolve([]);
      }
      throw e;
    }
  }

  async indexMovie(programs: (Movie & HasMediaSourceAndLibraryId)[]) {
    if (isEmpty(programs)) {
      return;
    }

    return await Promise.all(
      this.client()
        .index<ProgramSearchDocument>(ProgramsIndex.name)
        .addDocumentsInBatches(
          programs.map((p) => this.convertProgramToSearchDocument(p)),
          100,
        ),
    );
  }

  async updateMovie(
    movies: MarkRequired<
      Partial<Movie & HasMediaSourceAndLibraryId>,
      'uuid' | 'type'
    >[],
  ) {
    if (isEmpty(movies)) {
      return;
    }

    return await Promise.all(
      this.#client
        .index<ProgramSearchDocument>(ProgramsIndex.name)
        .updateDocumentsInBatches(
          movies.map((movie) =>
            this.convertPartialProgramToSearchDocument(movie),
          ),
          100,
        ),
    );
  }

  async updatePrograms(
    programs: MarkRequired<
      Partial<TerminalProgramSearchDocument<ProgramType>>,
      'id'
    >[],
  ) {
    return await Promise.all(
      this.#client
        .index<ProgramSearchDocument>(ProgramsIndex.name)
        .updateDocumentsInBatches(programs, 100),
    );
  }

  async indexOtherVideo(programs: (OtherVideo & HasMediaSourceAndLibraryId)[]) {
    if (isEmpty(programs)) {
      return;
    }

    return await Promise.all(
      this.client()
        .index<ProgramSearchDocument>(ProgramsIndex.name)
        .addDocumentsInBatches(
          programs.map((p) => this.convertProgramToSearchDocument(p)),
          100,
        ),
    );
  }

  async indexShow(show: Show & HasMediaSourceAndLibraryId) {
    const externalIds = show.identifiers.map((eid) => ({
      id: eid.id,
      source: eid.type,
      sourceId: eid.sourceId ? encodeCaseSensitiveId(eid.sourceId) : undefined,
    }));

    const document: ProgramGroupingSearchDocument<'show'> = {
      id: show.uuid,
      originalReleaseDate: show.releaseDate,
      originalReleaseYear: show.year,
      summary: show.summary,
      plot: show.plot,
      tagline: show.tagline,
      title: show.title,
      titleReverse: show.title.split('').reverse().join(''),
      rating: show.rating,
      genres: show.genres,
      actors: show.actors,
      director: [],
      libraryId: encodeCaseSensitiveId(show.libraryId),
      mediaSourceId: encodeCaseSensitiveId(show.mediaSourceId),
      type: ProgramGroupingType.Show,
      writer: [],
      externalIds,
      externalIdsMerged: show.identifiers.map(
        (eid) =>
          `${eid.type}|${eid.sourceId ?? ''}|${eid.id}` satisfies MergedExternalId,
      ),
      tags: show.tags,
    };

    await this.client()
      .index<
        ProgramGroupingSearchDocument<typeof ProgramGroupingType.Show>
      >(ProgramsIndex.name)
      .addDocuments([document]);
  }

  async indexSeason<ShowT extends Show = Show>(
    season: SeasonWithShow<MediaSourceSeason, ShowT>,
  ) {
    const externalIds = season.identifiers.map((eid) => ({
      id: eid.id,
      source: eid.type,
      sourceId: eid.sourceId ? encodeCaseSensitiveId(eid.sourceId) : undefined,
    }));

    const showEids = season.show.identifiers.map((eid) => ({
      id: eid.id,
      source: eid.type,
      sourceId: eid.sourceId ? encodeCaseSensitiveId(eid.sourceId) : undefined,
    }));

    const document: ProgramGroupingDocumentTypes['season'] = {
      id: season.uuid,
      originalReleaseDate: null,
      originalReleaseYear: season.year,
      summary: season.summary,
      plot: season.plot,
      tagline: season.tagline,
      title: season.title,
      titleReverse: season.title.split('').reverse().join(''),
      director: [],
      rating: null,
      actors: [],
      genres: [],
      studio: season.studios,
      libraryId: encodeCaseSensitiveId(season.libraryId),
      mediaSourceId: encodeCaseSensitiveId(season.mediaSourceId),
      type: ProgramGroupingType.Season,
      writer: [],
      externalIds,
      index: season.index,
      externalIdsMerged: season.identifiers.map(
        (eid) =>
          `${eid.type}|${eid.sourceId ?? ''}|${eid.id}` satisfies MergedExternalId,
      ),
      tags: season.tags,
      parent: {
        id: encodeCaseSensitiveId(season.show.uuid),
        externalIds: showEids ?? [],
        type: ProgramGroupingType.Show,
        externalIdsMerged: showEids.map(
          (eid) =>
            `${season.show.type}_${eid.source}|${eid.sourceId ?? ''}|${eid.id}` satisfies MergedGroupingExternalId<
              typeof ProgramGroupingType.Show
            >,
        ),
        title: season.show.title,
        year: season.show.year ?? undefined,
        genres: season.show.genres?.map(({ name }) => name) ?? [],
        studio: season.show.studios?.map(({ name }) => name) ?? [],
        tags: season.show.tags ?? [],
        rating: season.show.rating ?? undefined,
      } satisfies ProgramGroupingDenormDocument<
        typeof ProgramGroupingType.Show
      >,
    };

    await this.client()
      .index<ProgramGroupingDocumentTypes['season']>(ProgramsIndex.name)
      .addDocuments([document]);
  }

  async indexEpisodes<
    ShowT extends Show = Show,
    SeasonT extends Season<ShowT> = Season<ShowT>,
  >(programs: EpisodeWithAncestors2<MediaSourceEpisode, ShowT, SeasonT>[]) {
    if (isEmpty(programs)) return;

    const episodeDocuments = programs.map((program) => {
      const document = this.convertProgramToSearchDocument(program);
      const seasonEids = program.season.identifiers.map((eid) => ({
        id: eid.id,
        source: eid.type,
        sourceId: eid.sourceId
          ? encodeCaseSensitiveId(eid.sourceId)
          : undefined,
      }));

      const showEids = program.season.show.identifiers.map((eid) => ({
        id: eid.id,
        source: eid.type,
        sourceId: eid.sourceId
          ? encodeCaseSensitiveId(eid.sourceId)
          : undefined,
      }));

      document.parent = {
        id: encodeCaseSensitiveId(program.season.uuid),
        externalIds: seasonEids ?? [],
        type: program.season.type,
        externalIdsMerged: seasonEids.map(
          (eid) =>
            `${program.season.type}_${eid.source}|${eid.sourceId ?? ''}|${eid.id}` satisfies MergedGroupingExternalId<'season'>,
        ),
        title: program.season.title,
        year: program.season.year ?? undefined,
        genres: program.season.genres?.map(({ name }) => name) ?? [],
        studio: program.season.studios?.map(({ name }) => name) ?? [],
        tags: program.season.tags ?? [],
      } satisfies ProgramGroupingDenormDocument<
        typeof ProgramGroupingType.Season
      >;

      document.grandparent = {
        id: encodeCaseSensitiveId(program.season.show.uuid),
        type: program.season.show.type,
        externalIds: showEids,
        externalIdsMerged: showEids.map(
          (eid) =>
            `${program.season.show.type}_${eid.source}|${eid.sourceId ?? ''}|${eid.id}` satisfies MergedGroupingExternalId<'show'>,
        ),
        title: program.season.show.title,
        year: program.season.show.year ?? undefined,
        genres: program.season.show.genres?.map(({ name }) => name) ?? [],
        studio: program.season.show.studios?.map(({ name }) => name) ?? [],
        tags: program.season.show.tags ?? [],
        rating: program.season.show.rating ?? undefined,
      };
      return document;
    });

    return await Promise.all(
      this.client()
        .index<TerminalProgramSearchDocument<'episode'>>(ProgramsIndex.name)
        .addDocumentsInBatches(episodeDocuments, 100),
    );
  }

  async indexMusicArtist(artist: MusicArtist & HasMediaSourceAndLibraryId) {
    const externalIds = artist.identifiers.map((eid) => ({
      id: eid.id,
      source: eid.type,
      sourceId: eid.sourceId ? encodeCaseSensitiveId(eid.sourceId) : undefined,
    }));

    const document: ProgramGroupingDocumentTypes['artist'] = {
      id: artist.uuid,
      originalReleaseDate: null,
      originalReleaseYear: null,
      summary: artist.summary,
      plot: artist.plot,
      tagline: artist.tagline,
      title: artist.title,
      titleReverse: artist.title.split('').reverse().join(''),
      rating: null,
      genres: artist.genres ?? [],
      actors: [],
      director: [],
      libraryId: encodeCaseSensitiveId(artist.libraryId),
      mediaSourceId: encodeCaseSensitiveId(artist.mediaSourceId),
      type: ProgramGroupingType.Artist,
      writer: [],
      externalIds,
      externalIdsMerged: artist.identifiers.map(
        (eid) =>
          `${eid.type}|${eid.sourceId ?? ''}|${eid.id}` satisfies MergedExternalId,
      ),
      tags: artist.tags,
    };

    await this.client()
      .index<ProgramGroupingDocumentTypes['artist']>(ProgramsIndex.name)
      .addDocuments([document]);
  }

  async indexMusicAlbum<ArtistT extends MusicArtist = MusicArtist>(
    album: AlbumWithArtist<MediaSourceMusicAlbum, ArtistT>,
  ) {
    const externalIds = album.identifiers.map((eid) => ({
      id: eid.id,
      source: eid.type,
      sourceId: eid.sourceId ? encodeCaseSensitiveId(eid.sourceId) : undefined,
    }));

    const artistEids = album.artist.identifiers.map((eid) => ({
      id: eid.id,
      source: eid.type,
      sourceId: eid.sourceId ? encodeCaseSensitiveId(eid.sourceId) : undefined,
    }));

    const document: ProgramGroupingDocumentTypes['album'] = {
      id: album.uuid,
      originalReleaseDate: null,
      originalReleaseYear: album.year,
      summary: album.summary,
      plot: album.plot,
      tagline: album.tagline,
      title: album.title,
      titleReverse: album.title.split('').reverse().join(''),
      director: [],
      rating: null,
      actors: [],
      genres: album.genres ?? [],
      studio: album.studios,
      libraryId: encodeCaseSensitiveId(album.libraryId),
      mediaSourceId: encodeCaseSensitiveId(album.mediaSourceId),
      type: ProgramGroupingType.Album,
      writer: [],
      index: album.index,
      externalIds,
      externalIdsMerged: album.identifiers.map(
        (eid) =>
          `${eid.type}|${eid.sourceId ?? ''}|${eid.id}` satisfies MergedExternalId,
      ),
      tags: album.tags,
      parent: {
        id: encodeCaseSensitiveId(album.artist.uuid),
        externalIds: artistEids ?? [],
        type: ProgramGroupingType.Artist,
        externalIdsMerged: artistEids.map(
          (eid) =>
            `${album.artist.type}_${eid.source}|${eid.sourceId ?? ''}|${eid.id}` satisfies MergedGroupingExternalId<
              typeof ProgramGroupingType.Artist
            >,
        ),
        title: album.artist.title,
        genres: album.artist.genres?.map(({ name }) => name) ?? [],
        studio: [],
        tags: album.artist.tags ?? [],
      } satisfies ProgramGroupingDenormDocument<
        typeof ProgramGroupingType.Artist
      >,
    };

    await this.client()
      .index<ProgramGroupingDocumentTypes['album']>(ProgramsIndex.name)
      .addDocuments([document]);
  }

  async indexMusicTracks<
    ArtistT extends MusicArtist,
    AlbumT extends MusicAlbum<ArtistT> = MusicAlbum<ArtistT>,
  >(tracks: MusicTrackWithAncestors<MediaSourceMusicTrack, ArtistT, AlbumT>[]) {
    if (isEmpty(tracks)) return;

    const episodeDocuments = tracks.map((program) => {
      const document = this.convertProgramToSearchDocument(program);
      const seasonEids = program.album.identifiers.map((eid) => ({
        id: eid.id,
        source: eid.type,
        sourceId: eid.sourceId
          ? encodeCaseSensitiveId(eid.sourceId)
          : undefined,
      }));

      const showEids = program.album.artist.identifiers.map((eid) => ({
        id: eid.id,
        source: eid.type,
        sourceId: eid.sourceId
          ? encodeCaseSensitiveId(eid.sourceId)
          : undefined,
      }));

      document.parent = {
        id: encodeCaseSensitiveId(program.album.uuid),
        externalIds: seasonEids ?? [],
        type: program.album.type,
        externalIdsMerged: seasonEids.map(
          (eid) =>
            `${program.album.type}_${eid.source}|${eid.sourceId ?? ''}|${eid.id}` satisfies MergedGroupingExternalId<'album'>,
        ),
        title: program.album.title,
        year: program.album.year ?? undefined,
        genres: program.album.genres?.map(({ name }) => name) ?? [],
        studio: program.album.studios?.map(({ name }) => name) ?? [],
        tags: program.album.tags ?? [],
      } satisfies ProgramGroupingDenormDocument<
        typeof ProgramGroupingType.Album
      >;

      document.grandparent = {
        id: encodeCaseSensitiveId(program.album.artist.uuid),
        type: program.album.artist.type,
        externalIds: showEids,
        externalIdsMerged: showEids.map(
          (eid) =>
            `${program.album.artist.type}_${eid.source}|${eid.sourceId ?? ''}|${eid.id}` satisfies MergedGroupingExternalId<'artist'>,
        ),
        title: program.album.artist.title,
        genres: program.album.artist.genres?.map(({ name }) => name) ?? [],
        tags: program.album.artist.tags ?? [],
        studio: [],
      };
      return document;
    });

    return await Promise.all(
      this.client()
        .index<TerminalProgramSearchDocument<'track'>>(ProgramsIndex.name)
        .addDocumentsInBatches(episodeDocuments, 100),
    );
  }

  async search<
    IndexName extends keyof typeof IndexesByName,
    IndexDocumentTypeT extends Record<
      string,
      unknown
    > = IndexDocumentTypeByName<IndexName>,
  >(
    indexName: IndexName,
    request: SearchRequest<IndexTypeByName<IndexName>>,
  ): Promise<SearchResponse<IndexDocumentTypeT>> {
    const index = IndexesByName[indexName];
    let filter: Maybe<string>;
    if (request.filter) {
      filter = MeilisearchService.buildFilterExpression(index, request.filter);
    }

    if (
      isNonEmptyString(request.libraryId) &&
      index.filterable.includes('libraryId')
    ) {
      const encodedLibraryId = encodeCaseSensitiveId(request.libraryId);
      if (isNonEmptyString(filter)) {
        filter += ` AND libraryId = "${encodedLibraryId}"`;
      } else {
        filter = `libraryId = "${encodedLibraryId}"`;
      }
    }

    if (
      isNonEmptyString(request.mediaSourceId) &&
      index.filterable.includes('mediaSourceId')
    ) {
      const encodedMediaSourceId = encodeCaseSensitiveId(request.mediaSourceId);
      if (isNonEmptyString(filter)) {
        filter += ` AND mediaSourceId = "${encodedMediaSourceId}"`;
      } else {
        filter = `mediaSourceId = "${encodedMediaSourceId}"`;
      }
    }

    if (isNonEmptyString(request.query)) {
      const req = {
        filter,
        page: request.paging?.page,
        limit: request.paging?.limit,
        attributesToSearchOn: request.restrictSearchTo ?? undefined,
        facets: request.facets ?? undefined,
      } satisfies SearchParams;

      this.logger.debug(
        'Issuing search: query = %s, filter: %O (parsed: %O)',
        request.query,
        request.filter ?? {},
        req,
      );

      const searchResults = await this.client()
        .index<IndexDocumentTypeT>(index.name)
        .search(request.query, req);
      return {
        type: 'search',
        ...searchResults,
        results: searchResults.hits,
      };
    } else {
      const offset = request.paging
        ? request.paging.page * request.paging.limit
        : undefined;
      this.logger.debug(
        'Issuing get documents request: filter: "%s". offset: %d limit %d',
        filter ?? '',
        offset ?? 0,
        request.paging?.limit ?? -1,
      );

      const results = await this.client()
        .index<IndexDocumentTypeT>(index.name)
        .getDocuments({
          filter: filter,
          limit: request.paging?.limit,
          offset,
          // This does not exist on the type yet. Explicit cast because
          // the API supports it. Need https://github.com/meilisearch/meilisearch-js/pull/2038
          sort: ['title:asc' /*, 'originalReleaseDate:asc'*/],
        } as DocumentsQuery<IndexDocumentTypeT>);
      return {
        type: 'filter',
        ...results,
      };
    }
  }

  async facetSearch<IndexName extends keyof typeof IndexesByName>(
    indexName: IndexName,
    request: FacetSearchRequest,
  ) {
    const index = IndexesByName[indexName];

    let filter: Maybe<string>;
    if (request.filter) {
      filter = MeilisearchService.buildFilterExpression(index, request.filter);
    }

    if (
      isNonEmptyString(request.libraryId) &&
      index.filterable.includes('libraryId')
    ) {
      const encodedLibraryId = encodeCaseSensitiveId(request.libraryId);
      if (isNonEmptyString(filter)) {
        filter += ` AND libraryId = "${encodedLibraryId}"`;
      } else {
        filter = `libraryId = "${encodedLibraryId}"`;
      }
    }

    if (
      isNonEmptyString(request.mediaSourceId) &&
      index.filterable.includes('mediaSourceId')
    ) {
      const encodedMediaSourceId = encodeCaseSensitiveId(request.mediaSourceId);
      if (isNonEmptyString(filter)) {
        filter += ` AND mediaSourceId = "${encodedMediaSourceId}"`;
      } else {
        filter = `mediaSourceId = "${encodedMediaSourceId}"`;
      }
    }

    this.logger.debug(
      'Issuing facet search: (query = %s) filter = %O (parsed: %s)',
      request.facetQuery,
      request.filter ?? {},
      filter,
    );

    return this.client()
      .index(index.name)
      .searchForFacetValues({
        facetName: request.facetName,
        facetQuery: request.facetQuery,
        filter,
        attributesToSearchOn: request.facetQuery ? [request.facetName] : null,
        sort: [request.facetName],
      });
  }

  // AHHH!!!!
  async deleteAll() {
    return await this.#client.index(ProgramsIndex.name).deleteAllDocuments();
  }

  async deleteByIds(ids: string[]) {
    if (ids.length === 0) {
      return;
    }

    return await this.#client.index(ProgramsIndex.name).deleteDocuments(ids);
  }

  async deleteMissing() {
    const filter = `state = "missing"`;
    return await this.#client.index(ProgramsIndex.name).deleteDocuments({
      filter,
    });
  }

  async deleteByMediaSourceIds(ids: string[]) {
    if (ids.length === 0) {
      return;
    }

    const encodedIds = ids.map((id) => encodeCaseSensitiveId(id));
    const filter = `mediaSourceId NOT IN [${encodedIds.join(', ')}]`;

    return await this.#client.index(ProgramsIndex.name).deleteDocuments({
      filter,
    });
  }

  async createSnapshot() {
    const taskResult = await this.#client.createSnapshot();
    return taskResult.taskUid;
  }

  async monitorTask(id: number) {
    let task = await this.#client.tasks.getTask(id);
    if (!task) {
      this.logger.info(
        'Attempted to monitor search task %d but it was not found',
        id,
      );
      return;
    }

    while (task.status === 'enqueued' || task.status === 'processing') {
      switch (task.status) {
        case 'enqueued':
          this.logger.info('Task %d is enqueued', id);
          break;
        case 'processing':
          this.logger.info('Task %d is still processing...', id);
          break;
      }

      await wait(3_000);

      task = await this.#client.tasks.getTask(id);
      if (!task) {
        return;
      }
    }

    if (task.error) {
      this.logger.warn(
        task.error,
        'Task %d completed with status %s. %O',
        id,
        task.status,
        task.details ?? {},
      );
    } else {
      this.logger.info(
        'Task %d completed with status %s. %O',
        id,
        task.status,
        task.details ?? {},
      );
    }
  }

  static buildFilterExpression(
    index: GenericTunarrSearchIndex,
    query: SearchFilter,
    depth: number = 0,
    buf: string = '',
  ) {
    let v: string = '';
    switch (query.type) {
      case 'op': {
        if (query.children.length === 0) {
          return buf;
        }

        const op = query.op.toUpperCase();
        const children = query.children
          .map((q) => this.buildFilterExpression(index, q, depth + 1))
          .filter(isNonEmptyString);
        v = children.join(` ${op} `);
        // Nested grouped get parents to ensure the original intent is kept
        if (depth > 0 && children.length > 1) {
          v = `(${v})`;
        }
        break;
      }
      case 'value': {
        const maybeOpAndValue = match(query.fieldSpec)
          .with(
            { type: P.union('facted_string', 'string'), value: P.array() },
            ({ value, op }) => {
              const filteredValue = seq.collect(value, (v) =>
                isNonEmptyString(v) ? v : null,
              );
              if (filteredValue.length === 0) {
                return null;
              } else if (filteredValue.length === 1) {
                const v = index.caseSensitiveFilters?.includes(
                  query.fieldSpec.key,
                )
                  ? encodeCaseSensitiveId(filteredValue[0]!)
                  : filteredValue[0]!;
                const mappedOp = match(op)
                  .returnType<StringOperators>()
                  .with('in', () => '=')
                  .with('not in', () => '!=')
                  .otherwise(() => op);
                return `${mappedOp.toUpperCase()} '${v.replaceAll(`'`, `\\'`)}'`;
              } else if (op === 'in' || op === 'not in') {
                const searchOperator = op.toUpperCase();
                const v = index.caseSensitiveFilters?.includes(
                  query.fieldSpec.key,
                )
                  ? filteredValue.map(encodeCaseSensitiveId)
                  : filteredValue;
                return `${searchOperator} [${v.map((_) => `'${_.replaceAll(`'`, `\\'`)}'`).join(', ')}]`;
              } else {
                throw new Error(
                  `Unsupported search value configuration: ${JSON.stringify(query.fieldSpec)}`,
                );
              }
            },
          )
          .with(
            { type: P.union('date', 'numeric'), value: [P.number, P.number] },
            ({ value }) => {
              return `${value[0]} TO ${value[1]}`;
            },
          )
          .with(
            { type: P.union('date', 'numeric'), value: P.number },
            ({ value, op }) => `${op.toUpperCase()} ${value}`,
          )
          .otherwise(() => null);

        if (!maybeOpAndValue) {
          break;
        }

        v = `${query.fieldSpec.key} ${maybeOpAndValue}`;
        break;
      }
    }

    if (isNonEmptyString(v)) {
      return isNonEmptyString(buf) ? `${buf} ${v}` : v;
    }

    return buf;
  }

  private convertProgramToSearchDocument<
    ProgramT extends (Movie | Episode | MusicTrack | OtherVideo) &
      HasMediaSourceAndLibraryId,
  >(
    program: ProgramT,
  ): TerminalProgramSearchDocument<NoInfer<ProgramT['type']>> {
    const validEids = program.identifiers
      .map((eid) => ({
        id: eid.id,
        source: eid.type,
        sourceId: eid.sourceId
          ? encodeCaseSensitiveId(eid.sourceId)
          : undefined,
      }))
      .filter((eid) => {
        if (
          isValidMultiExternalIdType(eid.source) &&
          isNonEmptyString(eid.sourceId)
        ) {
          return true;
        } else if (
          isValidSingleExternalIdType(eid.source) &&
          isEmpty(eid.sourceId)
        ) {
          return true;
        }
        return false;
      });

    if (isEmpty(validEids) && program.sourceType !== 'local') {
      this.logger.warn('No external ids for item id %s', program.uuid);
    }

    const mergedExternalIds = validEids.map(
      (eid) =>
        `${eid.source}|${eid.sourceId ?? ''}|${eid.id}` satisfies MergedExternalId,
    );

    const width = program.mediaItem?.resolution?.widthPx;
    const height = program.mediaItem?.resolution?.heightPx;
    const videoStream = find(program.mediaItem?.streams, {
      streamType: 'video',
    });
    const audioStream = find(program.mediaItem?.streams, {
      streamType: 'audio',
    });

    let summary: string | null;
    switch (program.type) {
      case 'movie':
      case 'episode':
        summary = program.summary;
        break;
      case 'track':
      case 'other_video':
        summary = null;
        break;
    }

    let rating: string | null;
    switch (program.type) {
      case 'movie':
        rating = program.rating;
        break;
      case 'episode':
        rating = program.season?.show?.rating ?? null;
        break;
      case 'track':
      case 'other_video':
        rating = null;
        break;
    }

    return {
      id: program.uuid,
      duration: program.duration ?? null,
      externalIds: validEids,
      externalIdsMerged: mergedExternalIds,
      originalReleaseDate: Result.attempt(() => dayjs(program.releaseDate))
        .map((_) => _.valueOf())
        .getOrElse(() => null),
      originalReleaseYear: program.year,
      summary,
      plot: null,
      tagline: program.type === 'movie' ? program.tagline : null,
      title: program.title,
      titleReverse: program.title.split('').reverse().join(''),
      type: program.type,
      index:
        program.type === 'episode'
          ? program.episodeNumber
          : program.type === 'track'
            ? program.trackNumber
            : undefined,
      rating,
      genres: program.genres ?? [],
      actors: program.actors ?? [],
      director: program.directors ?? [],
      writer: program.writers ?? [],
      studio: program.studios ?? [],
      tags: program.tags,
      mediaSourceId: encodeCaseSensitiveId(program.mediaSourceId),
      libraryId: encodeCaseSensitiveId(program.libraryId),
      videoWidth: width,
      videoHeight: height,
      videoCodec: videoStream?.codec,
      videoBitDepth: nullToUndefined(videoStream?.bitDepth),
      audioCodec: audioStream?.codec,
      audioChannels: nullToUndefined(audioStream?.channels),
      state: 'ok',
    } satisfies TerminalProgramSearchDocument<typeof program.type>;
  }

  private convertPartialProgramToSearchDocument<
    ProgramT extends MarkRequired<
      Partial<TerminalProgram & HasMediaSourceAndLibraryId>,
      'uuid' | 'type'
    >,
  >(
    program: ProgramT,
  ): Partial<TerminalProgramSearchDocument<NoInfer<ProgramT['type']>>> {
    const validEids = program.identifiers
      ?.map((eid) => ({
        id: eid.id,
        source: eid.type,
        sourceId: eid.sourceId
          ? encodeCaseSensitiveId(eid.sourceId)
          : undefined,
      }))
      .filter((eid) => {
        if (
          isValidMultiExternalIdType(eid.source) &&
          isNonEmptyString(eid.sourceId)
        ) {
          return true;
        } else if (
          isValidSingleExternalIdType(eid.source) &&
          isEmpty(eid.sourceId)
        ) {
          return true;
        }
        return false;
      });

    if (isEmpty(validEids)) {
      this.logger.warn('No external ids for item id %s', program.uuid);
    }

    const mergedExternalIds = validEids?.map(
      (eid) =>
        `${eid.source}|${eid.sourceId ?? ''}|${eid.id}` satisfies MergedExternalId,
    );

    const width = program.mediaItem?.resolution?.widthPx;
    const height = program.mediaItem?.resolution?.heightPx;
    const videoStream = find(program.mediaItem?.streams, {
      streamType: 'video',
    });
    const audioStream = find(program.mediaItem?.streams, {
      streamType: 'audio',
    });

    let summary: Nilable<string>;
    switch (program.type) {
      case 'movie':
      case 'episode':
        summary = program?.summary;
        break;
      case 'track':
      case 'other_video':
      case 'music_video':
      default:
        summary = null;
        break;
    }

    let rating: Nilable<string>;
    switch (program.type) {
      case 'movie':
        rating = program.rating;
        break;
      case 'episode':
        rating = program.season?.show?.rating ?? null;
        break;
      default:
        break;
    }

    return {
      id: program.uuid,
      duration: program.duration,
      externalIds: validEids,
      externalIdsMerged: mergedExternalIds,
      originalReleaseDate: Result.attempt(() => dayjs(program.releaseDate))
        .map((_) => _.valueOf())
        .getOrElse(() => null),
      originalReleaseYear: program.year,
      summary,
      plot: null,
      tagline: program.type === 'movie' ? program.tagline : null,
      title: program.title,
      titleReverse: program.title?.split('').reverse().join(''),
      type: program.type,
      index:
        program.type === 'episode'
          ? program.episodeNumber
          : program.type === 'track'
            ? program.trackNumber
            : undefined,
      rating,
      genres: program.genres ?? [],
      actors: program.actors ?? [],
      director: program.directors ?? [],
      writer: program.writers ?? [],
      tags: program.tags,
      mediaSourceId: program.mediaSourceId
        ? encodeCaseSensitiveId(program.mediaSourceId)
        : undefined,
      libraryId: program.libraryId
        ? encodeCaseSensitiveId(program.libraryId)
        : undefined,
      videoWidth: width,
      videoHeight: height,
      videoCodec: videoStream?.codec,
      videoBitDepth: nullToUndefined(videoStream?.bitDepth),
      audioCodec: audioStream?.codec,
      audioChannels: nullToUndefined(audioStream?.channels),
    }; // satisfies TerminalProgramSearchDocument<typeof program.type>;
  }

  private async syncIndexSettings(index: GenericTunarrSearchIndex) {
    const programsIndex = this.client().index(index.name);

    const settings: Settings = {
      filterableAttributes: index.filterable,
      sortableAttributes: index.sortable,
    };

    const task = await programsIndex.updateSettings(settings);

    return this.waitForTaskResult(task.taskUid);
  }

  private async waitForTaskResult(
    taskId: number,
    canceledIsOk: boolean = false,
  ) {
    let status: EnqueuedTask['status'] = 'enqueued';
    let task: Task;
    do {
      task = await this.client().tasks.getTask(taskId);
      status = task.status;
      await wait(500);
    } while (
      status !== 'canceled' &&
      status !== 'failed' &&
      status !== 'succeeded'
    );

    if (status === 'succeeded' || (canceledIsOk && status === 'canceled')) {
      return;
    }

    throw new Error(
      `Task ${taskId} ended with status ${status}: ${task.error?.code} ${task?.error?.message}`,
    );
  }

  private get dbPath() {
    return path.join(this.serverOptions.databaseDirectory, 'data.ms');
  }
}

async function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, () => {
      const addr = server.address();
      server.close(() => {
        if (isString(addr) || isNull(addr)) {
          reject(new Error('Server was not open on a port'));
        } else {
          resolve(addr.port);
        }
      });
    });
  });
}

function encodeCaseSensitiveId(id: string): SingleCaseString {
  return tag(base32.encode(id));
}

export function decodeCaseSensitiveId(id: SingleCaseString): string {
  return base32.decode(id);
}
