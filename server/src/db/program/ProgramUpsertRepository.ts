import { GlobalScheduler } from '@/services/Scheduler.js';
import { ReconcileProgramDurationsTask } from '@/tasks/ReconcileProgramDurationsTask.js';
import { AnonymousTask } from '@/tasks/Task.js';
import { JellyfinTaskQueue, PlexTaskQueue } from '@/tasks/TaskQueue.js';
import { SaveJellyfinProgramExternalIdsTask } from '@/tasks/jellyfin/SaveJellyfinProgramExternalIdsTask.js';
import { SavePlexProgramExternalIdsTask } from '@/tasks/plex/SavePlexProgramExternalIdsTask.js';
import { autoFactoryKey, KEYS } from '@/types/inject.js';
import type { MarkNonNullable, Maybe } from '@/types/util.js';
import { Timer } from '@/util/Timer.js';
import {
    devAssert,
} from '@/util/debug.js';
import { type Logger } from '@/util/logging/LoggerFactory.js';
import { seq } from '@tunarr/shared/util';
import type { ChannelProgram, ContentProgram } from '@tunarr/types';
import { isContentProgram } from '@tunarr/types';
import dayjs from 'dayjs';
import { inject, injectable, interfaces } from 'inversify';
import type { Kysely, NotNull } from 'kysely';
import { UpdateResult } from 'kysely';
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
    keys,
    map,
    mapValues,
    omit,
    partition,
    reduce,
    reject,
    round,
    some,
    uniq,
    uniqBy,
} from 'lodash-es';
import type { Dictionary, MarkRequired } from 'ts-essentials';
import { typedProperty } from '../../types/path.ts';
import { getNumericEnvVar, TUNARR_ENV_VARS } from '../../util/env.ts';
import {
    groupByUniq,
    groupByUniqProp,
    isNonEmptyString,
    mapToObj,
    unzip as myUnzip,
    programExternalIdString,
    run,
} from '../../util/index.ts';
import { ProgramGroupingMinter } from '../converters/ProgramGroupingMinter.ts';
import { ProgramDaoMinter } from '../converters/ProgramMinter.ts';
import {
    ProgramSourceType,
    programSourceTypeFromString,
} from '../custom_types/ProgramSourceType.ts';
import {
    ProgramUpsertFields,
} from '../programQueryHelpers.ts';
import type { NewArtwork } from '../schema/Artwork.ts';
import type { NewCredit } from '../schema/Credit.ts';
import type { NewGenre } from '../schema/Genre.ts';
import type {
    NewProgramDao,
    ProgramDao,
} from '../schema/Program.ts';
import type { NewProgramChapter, ProgramChapter } from '../schema/ProgramChapter.ts';
import type { NewSingleOrMultiExternalId } from '../schema/ProgramExternalId.ts';
import type { NewProgramGrouping } from '../schema/ProgramGrouping.ts';
import { ProgramGroupingType } from '../schema/ProgramGrouping.ts';
import type { NewSingleOrMultiProgramGroupingExternalId } from '../schema/ProgramGroupingExternalId.ts';
import type { NewProgramMediaFile } from '../schema/ProgramMediaFile.ts';
import type { NewProgramMediaStream, ProgramMediaStream } from '../schema/ProgramMediaStream.ts';
import type { NewProgramSubtitles } from '../schema/ProgramSubtitles.ts';
import type { ProgramVersion } from '../schema/ProgramVersion.ts';
import type { NewStudio } from '../schema/Studio.ts';
import type { NewTag } from '../schema/Tag.ts';
import type { MediaSourceId, MediaSourceName } from '../schema/base.ts';
import type { DB } from '../schema/db.ts';
import type {
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
  program: NewProgramDao;
  externalIds: NewSingleOrMultiExternalId[];
  apiProgram: ContentProgram;
};

type ContentProgramWithHierarchy = Omit<
  MarkRequired<ContentProgram, 'grandparent' | 'parent'>,
  'subtype'
> & {
  subtype: 'episode' | 'track';
};

type RelevantProgramWithHierarchy = {
  program: ProgramDao;
  programWithHierarchy: ContentProgramWithHierarchy & {
    grandparentKey: string;
    parentKey: string;
  };
};

type ProgramRelationCaseBuilder = CaseWhenBuilder<
  DB,
  'program',
  unknown,
  string | null
>;

@injectable()
export class ProgramUpsertRepository {
  private timer: Timer;

  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(KEYS.Database) private db: Kysely<DB>,
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
      (p) =>
        isNonEmptyString(p.externalSourceType) &&
        isNonEmptyString(p.externalSourceId) &&
        isNonEmptyString(p.externalKey) &&
        p.duration > 0,
    );

    if (!isEmpty(invalidPrograms)) {
      this.logger.warn(
        'Found %d invalid programs when saving:\n%O',
        invalidPrograms.length,
        invalidPrograms,
      );
    }

    const programsToPersist: MintedNewProgramInfo[] = seq.collect(
      contentPrograms,
      (p) => {
        const program = minter.contentProgramDtoToDao(p);
        if (!program) {
          return;
        }
        const externalIds = minter.mintExternalIds(
          program.externalSourceId,
          program.mediaSourceId,
          program.uuid,
          p,
        );
        return { program, externalIds, apiProgram: p };
      },
    );

    const programInfoByUniqueId = groupByUniq(
      programsToPersist,
      ({ program }) => programExternalIdString(program),
    );

    this.logger.debug('Upserting %d programs', programsToPersist.length);

    const upsertedPrograms: MarkNonNullable<ProgramDao, 'mediaSourceId'>[] = [];
    await this.timer.timeAsync('programUpsert', async () => {
      for (const c of chunk(programsToPersist, programUpsertBatchSize)) {
        upsertedPrograms.push(
          ...(await this.db.transaction().execute((tx) =>
            tx
              .insertInto('program')
              .values(map(c, 'program'))
              .onConflict((oc) =>
                oc
                  .columns(['sourceType', 'mediaSourceId', 'externalKey'])
                  .doUpdateSet((eb) =>
                    mapToObj(ProgramUpsertFields, (f) => ({
                      [f.replace('excluded.', '')]: eb.ref(f),
                    })),
                  ),
              )
              .returningAll()
              .$narrowType<{ mediaSourceId: NotNull }>()
              .execute(),
          )),
        );
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
      this.handleProgramGroupings(upsertedPrograms, programInfoByUniqueId),
    );

    const [requiredExternalIds, backgroundExternalIds] = partition(
      programExternalIds,
      (p) => p.sourceType === 'plex' || p.sourceType === 'jellyfin',
    );

    await this.timer.timeAsync(
      `upsert ${requiredExternalIds.length} external ids`,
      () => this.externalIdRepo.upsertProgramExternalIds(requiredExternalIds, 200),
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
        AnonymousTask('UpsertExternalIds', () =>
          this.timer.timeAsync(
            `background external ID upsert (${backgroundExternalIds.length} ids)`,
            () => this.externalIdRepo.upsertProgramExternalIds(backgroundExternalIds),
          ),
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

    const db = this.db;

    const requestsByCanonicalId = groupByUniq(
      requests,
      ({ program }) => program.canonicalId,
    );

    const result = await Promise.all(
      chunk(requests, programUpsertBatchSize).map(async (c) => {
        const chunkResult = await db.transaction().execute((tx) =>
          tx
            .insertInto('program')
            .values(c.map(({ program }) => program))
            .onConflict((oc) =>
              oc
                .columns(['sourceType', 'mediaSourceId', 'externalKey'])
                .doUpdateSet((eb) =>
                  mapToObj(ProgramUpsertFields, (f) => ({
                    [f.replace('excluded.', '')]: eb.ref(f),
                  })),
                ),
            )
            .returningAll()
            .$narrowType<{ mediaSourceId: NotNull; canonicalId: NotNull }>()
            .execute(),
        );

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
          await this.externalIdRepo.upsertProgramExternalIds(allExternalIds);

        await this.upsertProgramVersions(versionsToInsert);

        await this.metadataRepo.upsertCredits(creditsToInsert);

        await this.metadataRepo.upsertArtwork(artworkToInsert);

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

  private async upsertProgramVersions(versions: NewProgramVersion[]) {
    if (versions.length === 0) {
      this.logger.warn('No program versions passed for item');
      return [];
    }

    const insertedVersions: ProgramVersion[] = [];
    await this.db.transaction().execute(async (tx) => {
      const byProgramId = groupByUniq(versions, (version) => version.programId);
      for (const batch of chunk(Object.entries(byProgramId), 50)) {
        const [programIds, versionBatch] = myUnzip(batch);
        await tx
          .deleteFrom('programVersion')
          .where('programId', 'in', programIds)
          .executeTakeFirstOrThrow();

        const insertResult = await tx
          .insertInto('programVersion')
          .values(
            versionBatch.map((version) =>
              omit(version, ['chapters', 'mediaStreams', 'mediaFiles']),
            ),
          )
          .returningAll()
          .execute();

        await this.upsertProgramMediaStreams(
          versionBatch.flatMap(({ mediaStreams }) => mediaStreams),
          tx,
        );
        await this.upsertProgramChapters(
          versionBatch.flatMap(({ chapters }) => chapters ?? []),
          tx,
        );
        await this.upsertProgramMediaFiles(
          versionBatch.flatMap(({ mediaFiles }) => mediaFiles),
          tx,
        );

        insertedVersions.push(...insertResult);
      }
    });
    return insertedVersions;
  }

  private async upsertProgramMediaStreams(
    streams: NewProgramMediaStream[],
    tx: Kysely<DB> = this.db,
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
        ...(await tx
          .insertInto('programMediaStream')
          .values(flatten(streams))
          .returningAll()
          .execute()),
      );
    }
    return inserted;
  }

  private async upsertProgramChapters(
    chapters: NewProgramChapter[],
    tx: Kysely<DB> = this.db,
  ) {
    if (chapters.length === 0) {
      return [];
    }

    const byVersionId = groupBy(chapters, (stream) => stream.programVersionId);
    const inserted: ProgramChapter[] = [];
    for (const batch of chunk(Object.entries(byVersionId), 50)) {
      const [_, streams] = myUnzip(batch);
      inserted.push(
        ...(await tx
          .insertInto('programChapter')
          .values(flatten(streams))
          .returningAll()
          .execute()),
      );
    }
    return inserted;
  }

  private async upsertProgramMediaFiles(
    files: NewProgramMediaFile[],
    tx: Kysely<DB> = this.db,
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
        ...(await tx
          .insertInto('programMediaFile')
          .values(flatten(files))
          .returningAll()
          .execute()),
      );
    }
    return inserted;
  }

  private async handleProgramGroupings(
    upsertedPrograms: MarkNonNullable<ProgramDao, 'mediaSourceId'>[],
    programInfos: Record<string, MintedNewProgramInfo>,
  ) {
    const bySourceAndServer = mapValues(
      groupBy(upsertedPrograms, 'sourceType'),
      (ps) => groupBy(ps, typedProperty('mediaSourceId')),
    );

    for (const [sourceType, byServerId] of Object.entries(bySourceAndServer)) {
      for (const [serverId, programs] of Object.entries(byServerId)) {
        const serverName = head(programs)!.externalSourceId;
        const typ = programSourceTypeFromString(sourceType);
        if (!typ) {
          return;
        }

        await this.handleSingleSourceProgramGroupings(
          programs,
          programInfos,
          typ,
          serverName,
          serverId as MediaSourceId,
        );
      }
    }
  }

  private async handleSingleSourceProgramGroupings(
    upsertedPrograms: MarkNonNullable<ProgramDao, 'mediaSourceId'>[],
    programInfos: Record<string, MintedNewProgramInfo>,
    mediaSourceType: ProgramSourceType,
    mediaSourceName: MediaSourceName,
    mediaSourceId: MediaSourceId,
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
          program.type === 'movie' ||
          program.type === 'music_video' ||
          program.type === 'other_video'
        ) {
          return;
        }

        const info = programInfos[programExternalIdString(program)];
        if (!info) {
          return;
        }

        if (
          info.apiProgram.subtype === 'movie' ||
          info.apiProgram.subtype === 'music_video' ||
          info.apiProgram.subtype === 'other_video'
        ) {
          return;
        }

        const [grandparentKey, parentKey] = [
          info.apiProgram.grandparent?.externalKey,
          info.apiProgram.parent?.externalKey,
        ];

        if (!grandparentKey || !parentKey) {
          this.logger.warn(
            'Unexpected null/empty parent keys: %O',
            info.apiProgram,
          );
          return;
        }

        return {
          program,
          programWithHierarchy: {
            ...(info.apiProgram as ContentProgramWithHierarchy),
            grandparentKey,
            parentKey,
          },
        };
      },
    );

    const upsertedProgramById = groupByUniqProp(
      map(relevantPrograms, ({ program }) => program),
      'uuid',
    );

    for (const {
      program,
      programWithHierarchy: { grandparentKey, parentKey },
    } of relevantPrograms) {
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
              eq(fields.sourceType, mediaSourceType),
              eq(fields.mediaSourceId, mediaSourceId),
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
        programWithHierarchy: { grandparentKey, parentKey },
      } of relevantPrograms) {
        if (group.externalKey === grandparentKey) {
          switch (upsertedProgram.type) {
            case 'episode':
              upsertedProgram.tvShowUuid = group.groupUuid;
              updatesByType[ProgramGroupingType.Show].add(upsertedProgram.uuid);
              break;
            case 'track':
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
            case 'episode':
              upsertedProgram.seasonUuid = group.groupUuid;
              updatesByType[ProgramGroupingType.Season].add(
                upsertedProgram.uuid,
              );
              break;
            case 'track':
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
    const groupings: NewProgramGrouping[] = [];
    const externalIds: NewSingleOrMultiProgramGroupingExternalId[] = [];
    for (const missingGrandparent of missingGrandparents) {
      const matchingPrograms = filter(
        relevantPrograms,
        ({ programWithHierarchy: { grandparentKey } }) =>
          grandparentKey === missingGrandparent,
      );

      if (isEmpty(matchingPrograms)) {
        continue;
      }

      const grandparentGrouping = ProgramGroupingMinter.mintGrandparentGrouping(
        matchingPrograms[0]!.programWithHierarchy,
      );

      if (grandparentGrouping === null) {
        devAssert(false);
        continue;
      }

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

        const parentGrouping = ProgramGroupingMinter.mintParentGrouping(
          programs[0]!.programWithHierarchy,
        );

        if (!parentGrouping) {
          continue;
        }

        programs.forEach(({ program }) => {
          if (program.type === 'episode') {
            program.seasonUuid = parentGrouping.uuid;
            updatesByType[ProgramGroupingType.Season].add(program.uuid);
          } else if (program.type === 'track') {
            program.albumUuid = parentGrouping.uuid;
            updatesByType[ProgramGroupingType.Album].add(program.uuid);
          }
        });

        if (parentGrouping.type === ProgramGroupingType.Season) {
          parentGrouping.showUuid = grandparentGrouping.uuid;
        } else if (parentGrouping.type === ProgramGroupingType.Album) {
          parentGrouping.artistUuid = grandparentGrouping.uuid;
        }

        groupings.push(parentGrouping);
        externalIds.push(
          ...ProgramGroupingMinter.mintGroupingExternalIds(
            programs[0]!.programWithHierarchy,
            parentGrouping.uuid,
            mediaSourceName,
            mediaSourceId,
            'parent',
          ),
        );
      }

      groupings.push(grandparentGrouping);
      externalIds.push(
        ...ProgramGroupingMinter.mintGroupingExternalIds(
          matchingPrograms[0]!.programWithHierarchy,
          grandparentGrouping.uuid,
          mediaSourceName,
          mediaSourceId,
          'grandparent',
        ),
      );
    }

    if (!isEmpty(groupings)) {
      await this.timer.timeAsync('upsert program_groupings', () =>
        this.db
          .transaction()
          .execute((tx) =>
            tx
              .insertInto('programGrouping')
              .values(groupings)
              .executeTakeFirstOrThrow(),
          ),
      );
    }

    if (!isEmpty(externalIds)) {
      await this.timer.timeAsync('upsert program_grouping external ids', () =>
        Promise.all(
          chunk(externalIds, 100).map((externalIdsChunk) =>
            this.db
              .transaction()
              .execute((tx) =>
                this.groupingUpsertRepo.upsertProgramGroupingExternalIdsChunk(externalIdsChunk, tx),
              ),
          ),
        ),
      );
    }

    const hasUpdates = some(updatesByType, (updates) => updates.size > 0);

    if (hasUpdates) {
      await this.timer.timeAsync('update program relations', () =>
        this.db.transaction().execute(async (tx) => {
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

          const updates: Promise<UpdateResult[]>[] = [];

          if (!isEmpty(tvShowIdUpdates)) {
            for (const idChunk of chunk(tvShowIdUpdates, chunkSize)) {
              updates.push(
                tx
                  .updateTable('program')
                  .set((eb) => ({
                    tvShowUuid: reduce(
                      idChunk,
                      (acc, curr) =>
                        acc
                          .when('program.uuid', '=', curr)
                          .then(upsertedProgramById[curr]!.tvShowUuid),
                      eb.case() as unknown as ProgramRelationCaseBuilder,
                    )
                      .else(eb.ref('program.tvShowUuid'))
                      .end(),
                  }))
                  .where('program.uuid', 'in', idChunk)
                  .execute(),
              );
            }
          }

          const seasonIdUpdates = [
            ...updatesByType[ProgramGroupingType.Season],
          ];

          if (!isEmpty(seasonIdUpdates)) {
            for (const idChunk of chunk(seasonIdUpdates, chunkSize)) {
              updates.push(
                tx
                  .updateTable('program')
                  .set((eb) => ({
                    seasonUuid: reduce(
                      idChunk,
                      (acc, curr) =>
                        acc
                          .when('program.uuid', '=', curr)
                          .then(upsertedProgramById[curr]!.seasonUuid),
                      eb.case() as unknown as ProgramRelationCaseBuilder,
                    )
                      .else(eb.ref('program.seasonUuid'))
                      .end(),
                  }))
                  .where('program.uuid', 'in', idChunk)
                  .execute(),
              );
            }
          }

          const musicArtistUpdates = [
            ...updatesByType[ProgramGroupingType.Artist],
          ];

          if (!isEmpty(musicArtistUpdates)) {
            for (const idChunk of chunk(musicArtistUpdates, chunkSize)) {
              updates.push(
                tx
                  .updateTable('program')
                  .set((eb) => ({
                    artistUuid: reduce(
                      idChunk,
                      (acc, curr) =>
                        acc
                          .when('program.uuid', '=', curr)
                          .then(upsertedProgramById[curr]!.artistUuid),
                      eb.case() as unknown as ProgramRelationCaseBuilder,
                    )
                      .else(eb.ref('program.artistUuid'))
                      .end(),
                  }))
                  .where('program.uuid', 'in', idChunk)
                  .execute(),
              );
            }
          }

          const musicAlbumUpdates = [
            ...updatesByType[ProgramGroupingType.Album],
          ];

          if (!isEmpty(musicAlbumUpdates)) {
            for (const idChunk of chunk(musicAlbumUpdates, chunkSize)) {
              updates.push(
                tx
                  .updateTable('program')
                  .set((eb) => ({
                    albumUuid: reduce(
                      idChunk,
                      (acc, curr) =>
                        acc
                          .when('program.uuid', '=', curr)
                          .then(upsertedProgramById[curr]!.albumUuid),
                      eb.case() as unknown as ProgramRelationCaseBuilder,
                    )
                      .else(eb.ref('program.albumUuid'))
                      .end(),
                  }))
                  .where('program.uuid', 'in', idChunk)
                  .execute(),
              );
            }
          }

          await Promise.all(updates);
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
