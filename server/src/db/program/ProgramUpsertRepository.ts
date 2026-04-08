import { GlobalScheduler } from '@/services/Scheduler.js';
import { ReconcileProgramDurationsTask } from '@/tasks/ReconcileProgramDurationsTask.js';
import { AnonymousTask } from '@/tasks/Task.js';
import { JellyfinTaskQueue, PlexTaskQueue } from '@/tasks/TaskQueue.js';
import { SaveJellyfinProgramExternalIdsTask } from '@/tasks/jellyfin/SaveJellyfinProgramExternalIdsTask.js';
import { SavePlexProgramExternalIdsTask } from '@/tasks/plex/SavePlexProgramExternalIdsTask.js';
import { autoFactoryKey, KEYS } from '@/types/inject.js';
import type { MarkNonNullable, Maybe } from '@/types/util.js';
import { Timer } from '@/util/Timer.js';
import { devAssert } from '@/util/debug.js';
import { type Logger } from '@/util/logging/LoggerFactory.js';
import { createExternalId } from '@tunarr/shared';
import { seq } from '@tunarr/shared/util';
import type {
  ChannelProgram,
  ContentProgram,
  EpisodeWithHierarchy,
  MusicTrackWithHierarchy,
} from '@tunarr/types';
import {
  isContentProgram,
  isEpisodeWithHierarchy,
  isMusicTrackWithHierarchy,
  tag,
  untag,
} from '@tunarr/types';
import dayjs from 'dayjs';
import { eq, inArray, sql } from 'drizzle-orm';
import { inject, injectable, interfaces } from 'inversify';
import {
  chunk,
  concat,
  difference,
  filter,
  flatMap,
  flatten,
  forEach,
  groupBy,
  head,
  isArray,
  isEmpty,
  isNull,
  keys,
  map,
  mapValues,
  omit,
  orderBy,
  partition,
  reject,
  round,
  some,
  uniq,
  uniqBy,
} from 'lodash-es';
import type { Dictionary } from 'ts-essentials';
import { typedProperty } from '../../types/path.ts';
import { getNumericEnvVar, TUNARR_ENV_VARS } from '../../util/env.ts';
import {
  groupByUniq,
  groupByUniqProp,
  isNonEmptyString,
  mapAsyncSeq,
  unzip as myUnzip,
  programExternalIdString,
  run,
} from '../../util/index.ts';
import { ProgramGroupingMinter } from '../converters/ProgramGroupingMinter.ts';
import { ProgramDaoMinter } from '../converters/ProgramMinter.ts';
import { ProgramSourceType } from '../custom_types/ProgramSourceType.ts';
import { caseWhen } from '../DrizzleSqlCaseWhen.ts';
import { ProgramUpsertSetClause } from '../programQueryHelpers.ts';
import type { NewArtwork } from '../schema/Artwork.ts';
import type { NewCredit } from '../schema/Credit.ts';
import type { NewGenre } from '../schema/Genre.ts';
import type { MediaSourceOrm } from '../schema/MediaSource.ts';
import type { MediaSourceLibrary } from '../schema/MediaSourceLibrary.ts';
import { Program, type ProgramDao, ProgramType } from '../schema/Program.ts';
import {
  ProgramChapter,
  type NewProgramChapter,
} from '../schema/ProgramChapter.ts';
import type { NewSingleOrMultiExternalId } from '../schema/ProgramExternalId.ts';
import { ProgramGroupingType } from '../schema/ProgramGrouping.ts';
import {
  ProgramMediaFile,
  type NewProgramMediaFile,
} from '../schema/ProgramMediaFile.ts';
import {
  ProgramMediaStream,
  type NewProgramMediaStream,
} from '../schema/ProgramMediaStream.ts';
import type { NewProgramSubtitles } from '../schema/ProgramSubtitles.ts';
import { ProgramVersion } from '../schema/ProgramVersion.ts';
import type { NewStudio } from '../schema/Studio.ts';
import type { NewTag } from '../schema/Tag.ts';
import type {
  MediaSourceWithLibraries,
  NewProgramGroupingWithRelations,
  NewProgramVersion,
  NewProgramWithRelations,
  ProgramWithExternalIds,
} from '../schema/derivedTypes.ts';
import type { DrizzleDBAccess } from '../schema/index.ts';
import { ProgramExternalIdRepository } from './ProgramExternalIdRepository.ts';
import { ProgramGroupingUpsertRepository } from './ProgramGroupingUpsertRepository.ts';
import { ProgramMetadataRepository } from './ProgramMetadataRepository.ts';

// Keep this low to make bun sqlite happy.
const DEFAULT_PROGRAM_GROUPING_UPDATE_CHUNK_SIZE = 100;

type MintedNewProgramInfo = {
  program: NewProgramWithRelations;
  externalIds: NewSingleOrMultiExternalId[];
  apiProgram: ContentProgram;
};

type RelevantProgramWithHierarchy = {
  program: ProgramDao;
  programWithHierarchy: EpisodeWithHierarchy | MusicTrackWithHierarchy;
  grandparentKey: string;
  parentKey: string;
};

@injectable()
export class ProgramUpsertRepository {
  private timer: Timer;

  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(KEYS.DrizzleDB) private drizzleDB: DrizzleDBAccess,
    @inject(autoFactoryKey(SavePlexProgramExternalIdsTask))
    private savePlexProgramExternalIdsTaskFactory: interfaces.AutoFactory<SavePlexProgramExternalIdsTask>,
    @inject(autoFactoryKey(SaveJellyfinProgramExternalIdsTask))
    private saveJellyfinProgramExternalIdsTask: interfaces.AutoFactory<SaveJellyfinProgramExternalIdsTask>,
    @inject(KEYS.ProgramDaoMinterFactory)
    private programMinterFactory: interfaces.AutoFactory<ProgramDaoMinter>,
    @inject(KEYS.ProgramExternalIdRepository)
    private externalIdRepo: ProgramExternalIdRepository,
    @inject(KEYS.ProgramMetadataRepository)
    private metadataRepo: ProgramMetadataRepository,
    @inject(KEYS.ProgramGroupingUpsertRepository)
    private groupingUpsertRepo: ProgramGroupingUpsertRepository,
    @inject(ProgramGroupingMinter)
    private programGroupingMinter: ProgramGroupingMinter,
  ) {
    this.timer = new Timer(this.logger);
  }

  async upsertContentPrograms(
    programs: ChannelProgram[],
    programUpsertBatchSize: number = 100,
  ): Promise<MarkNonNullable<ProgramDao, 'mediaSourceId'>[]> {
    if (isEmpty(programs)) {
      return [];
    }

    const start = performance.now();
    const [, nonPersisted] = partition(programs, (p) => p.persisted);
    const minter = this.programMinterFactory();

    const [contentPrograms, invalidPrograms] = partition(
      uniqBy(filter(nonPersisted, isContentProgram), (p) => p.uniqueId),
      ({ program }) =>
        isNonEmptyString(program.sourceType) &&
        isNonEmptyString(program.mediaSourceId) &&
        isNonEmptyString(program.externalId) &&
        program.duration > 0 &&
        isNonEmptyString(program.canonicalId) &&
        isNonEmptyString(program.libraryId),
    );

    if (!isEmpty(invalidPrograms)) {
      this.logger.warn(
        'Found %d invalid programs when saving:\n%O',
        invalidPrograms.length,
        invalidPrograms,
      );
    }

    const mediaSourcesAndLibraries =
      await this.drizzleDB.query.mediaSource.findMany({
        with: {
          libraries: true,
        },
      });
    const mediaSourcesById = groupByUniq(mediaSourcesAndLibraries, (ms) =>
      untag(ms.uuid),
    );
    const libraryById = groupByUniq(
      mediaSourcesAndLibraries.flatMap((ms) => ms.libraries),
      (lib) => lib.uuid,
    );

    const seenUniqueExternalSourceId = new Set<string>();
    const seenUniqueMediaSourceId = new Set<string>();

    const programsToPersist: MintedNewProgramInfo[] = seq.collect(
      contentPrograms,
      (p) => {
        const mediaSource = mediaSourcesById[p.program.mediaSourceId];
        if (!mediaSource) {
          this.logger.warn(
            'No media source with ID %s found on program when attempting to upsert.\n%O',
            p.program.mediaSourceId,
            p.program,
          );
          return;
        }

        const library = libraryById[p.program.libraryId];
        if (!library) {
          this.logger.warn(
            'No library with ID %s found on program when attempting to upsert.\n%O',
            p.program.libraryId,
            p.program,
          );
          return;
        }

        const program = minter.mint2(mediaSource, library, p.program);
        if (!program) {
          return;
        }

        const mediaSourceIdUnique = programExternalIdString(program.program);
        if (seenUniqueMediaSourceId.has(mediaSourceIdUnique)) {
          return;
        } else {
          seenUniqueMediaSourceId.add(mediaSourceIdUnique);
        }

        const externalSourceIdUnique =
          program.program.sourceType === 'local'
            ? program.program.externalKey
            : createExternalId(
                program.program.sourceType,
                tag(program.program.externalSourceId),
                program.program.externalKey,
              );
        if (seenUniqueExternalSourceId.has(externalSourceIdUnique)) {
          return;
        } else {
          seenUniqueExternalSourceId.add(externalSourceIdUnique);
        }

        const externalIds = program.externalIds;
        return { program, externalIds, apiProgram: p };
      },
    );

    const programInfoByUniqueId = groupByUniq(
      programsToPersist,
      ({ program }) => programExternalIdString(program.program),
    );

    this.logger.debug('Upserting %d programs', programsToPersist.length);

    const upsertedPrograms: MarkNonNullable<ProgramDao, 'mediaSourceId'>[] = [];
    this.timer.timeSync('programUpsert', () => {
      for (const chunkToInsert of chunk(
        programsToPersist,
        programUpsertBatchSize,
      )) {
        const programsToUpsert = chunkToInsert.map(
          ({ program: { program } }) => program,
        );
        try {
          upsertedPrograms.push(
            ...(this.drizzleDB.transaction((tx) =>
              tx
                .insert(Program)
                .values(programsToUpsert)
                .onConflictDoUpdate({
                  target: [
                    Program.sourceType,
                    Program.mediaSourceId,
                    Program.externalKey,
                  ],
                  set: ProgramUpsertSetClause,
                })
                .returning()
                .all(),
            ) as MarkNonNullable<ProgramDao, 'mediaSourceId'>[]),
          );
        } catch (e) {
          this.logger.error(
            e,
            'Error while inserting batch %j',
            programsToUpsert,
          );
        }
      }
    });

    const programExternalIds = flatMap(upsertedPrograms, (program) => {
      const eids =
        programInfoByUniqueId[programExternalIdString(program)]?.externalIds ??
        [];
      forEach(eids, (eid) => {
        eid.programUuid = program.uuid;
      });
      return eids;
    });

    await this.timer.timeAsync('programGroupings', () =>
      this.handleProgramGroupings(
        upsertedPrograms,
        programInfoByUniqueId,
        mediaSourcesAndLibraries,
      ),
    );

    const [requiredExternalIds, backgroundExternalIds] = partition(
      programExternalIds,
      (p) => p.sourceType === 'plex' || p.sourceType === 'jellyfin',
    );

    this.timer.timeSync(
      `upsert ${requiredExternalIds.length} external ids`,
      () =>
        this.externalIdRepo.upsertProgramExternalIds(requiredExternalIds, 200),
    );

    this.schedulePlexExternalIdsTask(upsertedPrograms);
    this.scheduleJellyfinExternalIdsTask(upsertedPrograms);

    setImmediate(() => {
      this.logger.debug('Scheduling follow-up program tasks...');

      GlobalScheduler.scheduleOneOffTask(
        autoFactoryKey(ReconcileProgramDurationsTask),
        dayjs().add(500, 'ms'),
        [],
      );

      PlexTaskQueue.resume();
      JellyfinTaskQueue.resume();

      this.logger.debug('Upserting external IDs in background');

      GlobalScheduler.scheduleOneOffTask(
        'UpsertExternalIds',
        dayjs().add(100),
        undefined,
        AnonymousTask('UpsertExternalIds', () => {
          this.timer.timeSync(
            `background external ID upsert (${backgroundExternalIds.length} ids)`,
            () =>
              this.externalIdRepo.upsertProgramExternalIds(
                backgroundExternalIds,
              ),
          );
          return Promise.resolve();
        },
        ),
      );
    });

    const end = performance.now();
    this.logger.debug(
      'upsertContentPrograms took %d millis. %d upsertedPrograms',
      round(end - start, 3),
      upsertedPrograms.length,
    );

    return upsertedPrograms;
  }

  upsertPrograms(
    request: NewProgramWithRelations,
  ): Promise<ProgramWithExternalIds>;
  upsertPrograms(
    programs: NewProgramWithRelations[],
    programUpsertBatchSize?: number,
  ): Promise<ProgramWithExternalIds[]>;
  async upsertPrograms(
    requests: NewProgramWithRelations | NewProgramWithRelations[],
    programUpsertBatchSize: number = 100,
  ): Promise<ProgramWithExternalIds | ProgramWithExternalIds[]> {
    const wasSingleRequest = !isArray(requests);
    requests = isArray(requests) ? requests : [requests];
    if (isEmpty(requests)) {
      return [];
    }

    const requestsByCanonicalId = groupByUniq(
      requests,
      ({ program }) => program.canonicalId,
    );

    const result = await Promise.all(
      chunk(requests, programUpsertBatchSize).map(async (c) => {
        const chunkResult = this.drizzleDB.transaction((tx) =>
          tx
            .insert(Program)
            .values(c.map(({ program }) => program))
            .onConflictDoUpdate({
              target: [
                Program.sourceType,
                Program.mediaSourceId,
                Program.externalKey,
              ],
              set: ProgramUpsertSetClause,
            })
            .returning()
            .all(),
        ) as MarkNonNullable<ProgramDao, 'mediaSourceId' | 'canonicalId'>[];

        const allExternalIds = flatten(c.map((program) => program.externalIds));
        const versionsToInsert: NewProgramVersion[] = [];
        const artworkToInsert: NewArtwork[] = [];
        const subtitlesToInsert: NewProgramSubtitles[] = [];
        const creditsToInsert: NewCredit[] = [];
        const genresToInsert: Dictionary<NewGenre[]> = {};
        const studiosToInsert: Dictionary<NewStudio[]> = {};
        const tagsToInsert: Dictionary<NewTag[]> = {};
        for (const program of chunkResult) {
          const key = program.canonicalId;
          const request: Maybe<NewProgramWithRelations> =
            requestsByCanonicalId[key];
          const eids = request?.externalIds ?? [];
          for (const eid of eids) {
            eid.programUuid = program.uuid;
          }

          for (const version of request?.versions ?? []) {
            version.programId = program.uuid;
            versionsToInsert.push(version);
          }

          for (const art of request?.artwork ?? []) {
            art.programId = program.uuid;
            artworkToInsert.push(art);
          }

          for (const subtitle of request?.subtitles ?? []) {
            subtitle.programId = program.uuid;
            subtitlesToInsert.push(subtitle);
          }

          for (const { credit, artwork } of request?.credits ?? []) {
            credit.programId = program.uuid;
            creditsToInsert.push(credit);
            artworkToInsert.push(...artwork);
          }

          for (const genre of request?.genres ?? []) {
            genresToInsert[program.uuid] ??= [];
            genresToInsert[program.uuid]?.push(genre);
          }

          for (const studio of request?.studios ?? []) {
            studiosToInsert[program.uuid] ??= [];
            studiosToInsert[program.uuid]?.push(studio);
          }

          for (const tag of request?.tags ?? []) {
            tagsToInsert[program.uuid] ??= [];
            tagsToInsert[program.uuid]?.push(tag);
          }
        }

        const externalIdsByProgramId =
          this.externalIdRepo.upsertProgramExternalIds(allExternalIds);

        this.upsertProgramVersions(versionsToInsert);

        this.metadataRepo.upsertCredits(creditsToInsert);

        this.metadataRepo.upsertArtwork(artworkToInsert);

        await this.metadataRepo.upsertSubtitles(subtitlesToInsert);

        for (const [programId, genres] of Object.entries(genresToInsert)) {
          await this.metadataRepo.upsertProgramGenres(programId, genres);
        }

        for (const [programId, studios] of Object.entries(studiosToInsert)) {
          await this.metadataRepo.upsertProgramStudios(programId, studios);
        }

        for (const [programId, tags] of Object.entries(tagsToInsert)) {
          await this.metadataRepo.upsertProgramTags(programId, tags);
        }

        return chunkResult.map(
          (upsertedProgram) =>
            ({
              ...upsertedProgram,
              externalIds: externalIdsByProgramId[upsertedProgram.uuid] ?? [],
            }) satisfies ProgramWithExternalIds,
        );
      }),
    ).then(flatten);

    if (wasSingleRequest) {
      return head(result)!;
    } else {
      return result;
    }
  }

  private upsertProgramVersions(versions: NewProgramVersion[]) {
    if (versions.length === 0) {
      this.logger.warn('No program versions passed for item');
      return [];
    }

    const insertedVersions: ProgramVersion[] = [];
    this.drizzleDB.transaction((tx) => {
      const byProgramId = groupByUniq(versions, (version) => version.programId);
      for (const batch of chunk(Object.entries(byProgramId), 50)) {
        const [programIds, versionBatch] = myUnzip(batch);
        tx.delete(ProgramVersion)
          .where(inArray(ProgramVersion.programId, programIds))
          .run();

        const insertResult = tx
          .insert(ProgramVersion)
          .values(
            versionBatch.map((version) =>
              omit(version, ['chapters', 'mediaStreams', 'mediaFiles']),
            ),
          )
          .returning()
          .all();

        this.upsertProgramMediaStreams(
          versionBatch.flatMap(({ mediaStreams }) => mediaStreams),
          tx,
        );
        this.upsertProgramChapters(
          versionBatch.flatMap(({ chapters }) => chapters ?? []),
          tx,
        );
        this.upsertProgramMediaFiles(
          versionBatch.flatMap(({ mediaFiles }) => mediaFiles),
          tx,
        );

        insertedVersions.push(...insertResult);
      }
    });
    return insertedVersions;
  }

  private upsertProgramMediaStreams(
    streams: NewProgramMediaStream[],
    tx: DrizzleDBAccess = this.drizzleDB,
  ) {
    if (streams.length === 0) {
      this.logger.warn('No media streams passed for version');
      return [];
    }

    const byVersionId = groupBy(streams, (stream) => stream.programVersionId);
    const inserted: ProgramMediaStream[] = [];
    for (const batch of chunk(Object.entries(byVersionId), 50)) {
      const [_, streams] = myUnzip(batch);
      inserted.push(
        ...tx
          .insert(ProgramMediaStream)
          .values(flatten(streams))
          .returning()
          .all(),
      );
    }
    return inserted;
  }

  private upsertProgramChapters(
    chapters: NewProgramChapter[],
    tx: DrizzleDBAccess = this.drizzleDB,
  ) {
    if (chapters.length === 0) {
      return [];
    }

    const byVersionId = groupBy(chapters, (stream) => stream.programVersionId);
    const inserted: ProgramChapter[] = [];
    for (const batch of chunk(Object.entries(byVersionId), 50)) {
      const [_, streams] = myUnzip(batch);
      inserted.push(
        ...tx
          .insert(ProgramChapter)
          .values(flatten(streams))
          .returning()
          .all(),
      );
    }
    return inserted;
  }

  private upsertProgramMediaFiles(
    files: NewProgramMediaFile[],
    tx: DrizzleDBAccess = this.drizzleDB,
  ) {
    if (files.length === 0) {
      this.logger.warn('No media files passed for version');
      return [];
    }

    const byVersionId = groupBy(files, (stream) => stream.programVersionId);
    const inserted: ProgramMediaFile[] = [];
    for (const batch of chunk(Object.entries(byVersionId), 50)) {
      const [_, files] = myUnzip(batch);
      inserted.push(
        ...tx
          .insert(ProgramMediaFile)
          .values(flatten(files))
          .returning()
          .all(),
      );
    }
    return inserted;
  }

  private async handleProgramGroupings(
    upsertedPrograms: MarkNonNullable<ProgramDao, 'mediaSourceId'>[],
    programInfos: Record<string, MintedNewProgramInfo>,
    mediaSourcesAndLibraries: MediaSourceWithLibraries[],
  ) {
    const mediaSourceById = groupByUniq(mediaSourcesAndLibraries, (ms) =>
      untag(ms.uuid),
    );

    const programsBySourceAndLibrary = mapValues(
      groupBy(upsertedPrograms, typedProperty('mediaSourceId')),
      (ps) => groupBy(ps, typedProperty('libraryId')),
    );

    for (const [sourceId, byLibraryId] of Object.entries(
      programsBySourceAndLibrary,
    )) {
      const mediaSource = mediaSourceById[sourceId];
      if (!mediaSource || mediaSource.type === 'local') {
        continue;
      }

      for (const [libraryId, programs] of Object.entries(byLibraryId)) {
        const library = mediaSource.libraries.find(
          (lib) => lib.uuid === libraryId,
        );
        if (!library) {
          continue;
        }

        await this.handleSingleSourceProgramGroupings(
          programs,
          programInfos,
          mediaSource,
          library,
        );
      }
    }
  }

  private async handleSingleSourceProgramGroupings(
    upsertedPrograms: MarkNonNullable<ProgramDao, 'mediaSourceId'>[],
    programInfos: Record<string, MintedNewProgramInfo>,
    mediaSource: MediaSourceOrm,
    library: MediaSourceLibrary,
  ) {
    const grandparentRatingKeyToParentRatingKey: Record<
      string,
      Set<string>
    > = {};
    const grandparentRatingKeyToProgramId: Record<string, Set<string>> = {};
    const parentRatingKeyToProgramId: Record<string, Set<string>> = {};

    const relevantPrograms: RelevantProgramWithHierarchy[] = seq.collect(
      upsertedPrograms,
      (program) => {
        if (
          (['movie', 'other_video', 'music_video'] as ProgramType[]).includes(
            program.type,
          )
        ) {
          return;
        }

        const info = programInfos[programExternalIdString(program)];
        if (!info) {
          return;
        }

        if (
          (['movie', 'other_video', 'music_video'] as ProgramType[]).includes(
            info.apiProgram.program.type,
          )
        ) {
          return;
        }

        if (
          isEpisodeWithHierarchy(info.apiProgram.program) ||
          isMusicTrackWithHierarchy(info.apiProgram.program)
        ) {
          const grandparentKey = isEpisodeWithHierarchy(info.apiProgram.program)
            ? extractShowId(info.apiProgram.program)
            : extractArtistId(info.apiProgram.program);
          const parentKey = isEpisodeWithHierarchy(info.apiProgram.program)
            ? info.apiProgram.program.season.externalId
            : info.apiProgram.program.album.externalId;

          return {
            program,
            programWithHierarchy: info.apiProgram.program,
            grandparentKey,
            parentKey,
          };
        }

        return;
      },
    );

    const upsertedProgramById = groupByUniqProp(
      map(relevantPrograms, ({ program }) => program),
      'uuid',
    );

    for (const { program, grandparentKey, parentKey } of relevantPrograms) {
      if (isNonEmptyString(grandparentKey)) {
        (grandparentRatingKeyToProgramId[grandparentKey] ??= new Set()).add(
          program.uuid,
        );

        const set = (grandparentRatingKeyToParentRatingKey[grandparentKey] ??=
          new Set());
        if (isNonEmptyString(parentKey)) {
          set.add(parentKey);
        }
      }

      if (isNonEmptyString(parentKey)) {
        (parentRatingKeyToProgramId[parentKey] ??= new Set()).add(program.uuid);
      }
    }

    const allGroupingKeys = concat(
      keys(grandparentRatingKeyToParentRatingKey),
      keys(parentRatingKeyToProgramId),
    );

    const existingGroupings = await this.timer.timeAsync(
      `selecting grouping external ids (${allGroupingKeys.length})`,
      () =>
        this.drizzleDB.query.programGroupingExternalId.findMany({
          where: (fields, { eq, and, inArray }) =>
            and(
              // this is always true, appease the typechecker
              mediaSource.type !== 'local'
                ? eq(fields.sourceType, mediaSource.type)
                : undefined,
              eq(fields.mediaSourceId, mediaSource.uuid),
              inArray(fields.externalKey, allGroupingKeys),
            ),
          with: {
            grouping: true,
          },
        }),
    );

    const foundGroupingRatingKeys = map(existingGroupings, 'externalKey');
    const missingGroupingRatingKeys = difference(
      allGroupingKeys,
      foundGroupingRatingKeys,
    );
    const grandparentKeys = new Set(keys(grandparentRatingKeyToProgramId));
    const missingGrandparents = filter(missingGroupingRatingKeys, (s) =>
      grandparentKeys.has(s),
    );

    const updatesByType: Record<ProgramGroupingType, Set<string>> = {
      album: new Set(),
      artist: new Set(),
      season: new Set(),
      show: new Set(),
    } as const;

    for (const group of existingGroupings) {
      for (const {
        program: upsertedProgram,
        grandparentKey,
        parentKey,
      } of relevantPrograms) {
        if (group.externalKey === grandparentKey) {
          switch (upsertedProgram.type) {
            case ProgramType.Episode:
              upsertedProgram.tvShowUuid = group.groupUuid;
              updatesByType[ProgramGroupingType.Show].add(upsertedProgram.uuid);
              break;
            case ProgramType.Track:
              upsertedProgram.artistUuid = group.groupUuid;
              updatesByType[ProgramGroupingType.Artist].add(
                upsertedProgram.uuid,
              );
              break;
            case 'movie':
            case 'music_video':
            case 'other_video':
            default:
              this.logger.warn(
                'Unexpected program type %s when calculating hierarchy. id = %s',
                upsertedProgram.type,
                upsertedProgram.uuid,
              );
              break;
          }
        } else if (group.externalKey === parentKey) {
          switch (upsertedProgram.type) {
            case ProgramType.Episode:
              upsertedProgram.seasonUuid = group.groupUuid;
              updatesByType[ProgramGroupingType.Season].add(
                upsertedProgram.uuid,
              );
              break;
            case ProgramType.Track:
              upsertedProgram.albumUuid = group.groupUuid;
              updatesByType[ProgramGroupingType.Album].add(
                upsertedProgram.uuid,
              );
              break;
            case 'movie':
            case 'music_video':
            case 'other_video':
            default:
              this.logger.warn(
                'Unexpected program type %s when calculating hierarchy. id = %s',
                upsertedProgram.type,
                upsertedProgram.uuid,
              );
              break;
          }
        }
      }
    }

    // New ones
    const groupings: NewProgramGroupingWithRelations[] = [];
    for (const missingGrandparent of missingGrandparents) {
      const matchingPrograms = filter(
        relevantPrograms,
        ({ grandparentKey }) => grandparentKey === missingGrandparent,
      );

      if (isEmpty(matchingPrograms)) {
        continue;
      }

      const grandparentGroupingAndRelations =
        this.programGroupingMinter.mintGrandparentGrouping(
          matchingPrograms[0]!.programWithHierarchy,
          mediaSource,
          library,
        );

      if (isNull(grandparentGroupingAndRelations)) {
        devAssert(false);
        continue;
      }

      const { programGrouping: grandparentGrouping } =
        grandparentGroupingAndRelations;

      matchingPrograms.forEach(({ program }) => {
        if (grandparentGrouping.type === ProgramGroupingType.Artist) {
          program.artistUuid = grandparentGrouping.uuid;
          updatesByType[ProgramGroupingType.Artist].add(program.uuid);
        } else if (grandparentGrouping.type === ProgramGroupingType.Show) {
          program.tvShowUuid = grandparentGrouping.uuid;
          updatesByType[ProgramGroupingType.Show].add(program.uuid);
        }
      });

      const parentKeys = [
        ...(grandparentRatingKeyToParentRatingKey[missingGrandparent] ??
          new Set()),
      ];
      const parents = reject(parentKeys, (parent) =>
        foundGroupingRatingKeys.includes(parent),
      );

      for (const parentKey of parents) {
        const programIds = parentRatingKeyToProgramId[parentKey];
        if (!programIds || programIds.size === 0) {
          devAssert(false);
          continue;
        }

        const programs = filter(relevantPrograms, ({ program }) =>
          programIds.has(program.uuid),
        );

        if (isEmpty(programs)) {
          devAssert(false);
          continue;
        }

        devAssert(
          () => uniq(map(programs, ({ program: p }) => p.type)).length === 1,
        );

        const parentGroupingWithRelations =
          this.programGroupingMinter.mintParentGrouping(
            programs[0]!.programWithHierarchy,
            mediaSource,
            library,
          );

        if (!parentGroupingWithRelations) {
          continue;
        }

        const { programGrouping: parentGrouping } = parentGroupingWithRelations;

        programs.forEach(({ program }) => {
          if (program.type === ProgramType.Episode) {
            program.seasonUuid = parentGrouping.uuid;
            updatesByType[ProgramGroupingType.Season].add(program.uuid);
          } else if (program.type === ProgramType.Track) {
            program.albumUuid = parentGrouping.uuid;
            updatesByType[ProgramGroupingType.Album].add(program.uuid);
          }
        });

        if (parentGrouping.type === ProgramGroupingType.Season) {
          parentGrouping.showUuid = grandparentGrouping.uuid;
        } else if (parentGrouping.type === ProgramGroupingType.Album) {
          parentGrouping.artistUuid = grandparentGrouping.uuid;
        }

        groupings.push(parentGroupingWithRelations);
      }

      groupings.push(grandparentGroupingAndRelations);
    }

    if (!isEmpty(groupings)) {
      // Have to insert grandparents first so their IDs exist in the DB
      // for foreign keys set on their descendents.
      const sortedGroupings = orderBy(
        groupings,
        (group) =>
          group.programGrouping.type === 'artist' ||
          group.programGrouping.type === 'show',
        'desc',
      );
      await this.timer.timeAsync('upsert program_groupings', () =>
        mapAsyncSeq(sortedGroupings, (grouping) => {
          try {
            return this.groupingUpsertRepo.upsertProgramGrouping(grouping);
          } catch (e) {
            this.logger.error(
              e,
              'Failed to upsert program grouping: %j',
              grouping,
            );
            throw e;
          }
        }),
      );
    }

    const hasUpdates = some(updatesByType, (updates) => updates.size > 0);

    if (hasUpdates) {
      this.timer.timeSync('update program relations', () =>
        this.drizzleDB.transaction((tx) => {
          const tvShowIdUpdates = [...updatesByType[ProgramGroupingType.Show]];

          const chunkSize = run(() => {
            const envVal = getNumericEnvVar(
              TUNARR_ENV_VARS.DEBUG__PROGRAM_GROUPING_UPDATE_CHUNK_SIZE,
            );

            if (isNonEmptyString(envVal) && !isNaN(parseInt(envVal))) {
              return Math.min(10_000, parseInt(envVal));
            }
            return DEFAULT_PROGRAM_GROUPING_UPDATE_CHUNK_SIZE;
          });

          if (!isEmpty(tvShowIdUpdates)) {
            for (const idChunk of chunk(tvShowIdUpdates, chunkSize)) {
              const first = idChunk[0]!;
              const caseExpr = idChunk
                .slice(1)
                .reduce(
                  (acc, curr) =>
                    acc.when(
                      eq(Program.uuid, curr),
                      sql`${upsertedProgramById[curr]!.tvShowUuid}`,
                    ),
                  caseWhen(
                    eq(Program.uuid, first),
                    sql`${upsertedProgramById[first]!.tvShowUuid}`,
                  ),
                )
                .else(Program.tvShowUuid);

              tx.update(Program)
                .set({ tvShowUuid: caseExpr })
                .where(inArray(Program.uuid, idChunk))
                .run();
            }
          }

          const seasonIdUpdates = [
            ...updatesByType[ProgramGroupingType.Season],
          ];

          if (!isEmpty(seasonIdUpdates)) {
            for (const idChunk of chunk(seasonIdUpdates, chunkSize)) {
              const first = idChunk[0]!;
              const caseExpr = idChunk
                .slice(1)
                .reduce(
                  (acc, curr) =>
                    acc.when(
                      eq(Program.uuid, curr),
                      sql`${upsertedProgramById[curr]!.seasonUuid}`,
                    ),
                  caseWhen(
                    eq(Program.uuid, first),
                    sql`${upsertedProgramById[first]!.seasonUuid}`,
                  ),
                )
                .else(Program.seasonUuid);

              tx.update(Program)
                .set({ seasonUuid: caseExpr })
                .where(inArray(Program.uuid, idChunk))
                .run();
            }
          }

          const musicArtistUpdates = [
            ...updatesByType[ProgramGroupingType.Artist],
          ];

          if (!isEmpty(musicArtistUpdates)) {
            for (const idChunk of chunk(musicArtistUpdates, chunkSize)) {
              const first = idChunk[0]!;
              const caseExpr = idChunk
                .slice(1)
                .reduce(
                  (acc, curr) =>
                    acc.when(
                      eq(Program.uuid, curr),
                      sql`${upsertedProgramById[curr]!.artistUuid}`,
                    ),
                  caseWhen(
                    eq(Program.uuid, first),
                    sql`${upsertedProgramById[first]!.artistUuid}`,
                  ),
                )
                .else(Program.artistUuid);

              tx.update(Program)
                .set({ artistUuid: caseExpr })
                .where(inArray(Program.uuid, idChunk))
                .run();
            }
          }

          const musicAlbumUpdates = [
            ...updatesByType[ProgramGroupingType.Album],
          ];

          if (!isEmpty(musicAlbumUpdates)) {
            for (const idChunk of chunk(musicAlbumUpdates, chunkSize)) {
              const first = idChunk[0]!;
              const caseExpr = idChunk
                .slice(1)
                .reduce(
                  (acc, curr) =>
                    acc.when(
                      eq(Program.uuid, curr),
                      sql`${upsertedProgramById[curr]!.albumUuid}`,
                    ),
                  caseWhen(
                    eq(Program.uuid, first),
                    sql`${upsertedProgramById[first]!.albumUuid}`,
                  ),
                )
                .else(Program.albumUuid);

              tx.update(Program)
                .set({ albumUuid: caseExpr })
                .where(inArray(Program.uuid, idChunk))
                .run();
            }
          }
        }),
      );
    }
  }

  private schedulePlexExternalIdsTask(upsertedPrograms: ProgramDao[]) {
    PlexTaskQueue.pause();
    this.timer.timeSync('schedule Plex external IDs tasks', () => {
      forEach(
        filter(upsertedPrograms, { sourceType: ProgramSourceType.PLEX }),
        (program) => {
          try {
            const task = this.savePlexProgramExternalIdsTaskFactory();
            task.logLevel = 'trace';
            PlexTaskQueue.add(task, { programId: program.uuid }).catch((e) => {
              this.logger.error(
                e,
                'Error saving external IDs for program %O',
                program,
              );
            });
          } catch (e) {
            this.logger.error(
              e,
              'Failed to schedule external IDs task for persisted program: %O',
              program,
            );
          }
        },
      );
    });
  }

  private scheduleJellyfinExternalIdsTask(upsertedPrograms: ProgramDao[]) {
    JellyfinTaskQueue.pause();
    this.timer.timeSync('Schedule Jellyfin external IDs tasks', () => {
      forEach(
        filter(upsertedPrograms, (p) => p.sourceType === 'jellyfin'),
        (program) => {
          try {
            const task = this.saveJellyfinProgramExternalIdsTask();
            JellyfinTaskQueue.add(task, { programId: program.uuid }).catch(
              (e) => {
                this.logger.error(
                  e,
                  'Error saving external IDs for program %O',
                  program,
                );
              },
            );
          } catch (e) {
            this.logger.error(
              e,
              'Failed to schedule external IDs task for persisted program: %O',
              program,
            );
          }
        },
      );
    });
  }
}

function extractShowId(program: EpisodeWithHierarchy) {
  return program.show?.externalId ?? program.season?.show.externalId;
}

function extractArtistId(program: MusicTrackWithHierarchy) {
  return program.artist?.externalId ?? program.album?.artist.externalId;
}
