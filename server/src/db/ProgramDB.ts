import type { IProgramDB } from '@/db/interfaces/IProgramDB.js';
import { GlobalScheduler } from '@/services/Scheduler.js';
import { ReconcileProgramDurationsTask } from '@/tasks/ReconcileProgramDurationsTask.js';
import { AnonymousTask } from '@/tasks/Task.js';
import { JellyfinTaskQueue, PlexTaskQueue } from '@/tasks/TaskQueue.js';
import { SaveJellyfinProgramExternalIdsTask } from '@/tasks/jellyfin/SaveJellyfinProgramExternalIdsTask.js';
import { SavePlexProgramExternalIdsTask } from '@/tasks/plex/SavePlexProgramExternalIdsTask.js';
import { KEYS } from '@/types/inject.js';
import { Maybe } from '@/types/util.js';
import { Timer } from '@/util/Timer.js';
import { devAssert } from '@/util/debug.js';
import { type Logger } from '@/util/logging/LoggerFactory.js';
import { createExternalId } from '@tunarr/shared';
import { seq } from '@tunarr/shared/util';
import {
  ChannelProgram,
  ContentProgram,
  isContentProgram,
} from '@tunarr/types';
import dayjs from 'dayjs';
import { inject, injectable } from 'inversify';
import { CaseWhenBuilder } from 'kysely';
import {
  chunk,
  concat,
  difference,
  filter,
  first,
  flatMap,
  forEach,
  groupBy,
  isEmpty,
  isNil,
  isNull,
  keys,
  map,
  mapValues,
  partition,
  reduce,
  reject,
  round,
  some,
  uniq,
  uniqBy,
  values,
} from 'lodash-es';
import { MarkOptional, MarkRequired } from 'ts-essentials';
import { v4 } from 'uuid';
import {
  flatMapAsyncSeq,
  groupByUniq,
  groupByUniqProp,
  isNonEmptyString,
  mapToObj,
} from '../util/index.ts';
import { getDatabase } from './DBAccess.ts';
import { ProgramConverter } from './converters/ProgramConverter.ts';
import { ProgramGroupingMinter } from './converters/ProgramGroupingMinter.ts';
import { ProgramMinterFactory } from './converters/ProgramMinter.ts';
import { ProgramExternalIdType } from './custom_types/ProgramExternalIdType.ts';
import {
  ProgramSourceType,
  programSourceTypeFromString,
} from './custom_types/ProgramSourceType.ts';
import { upsertRawProgramExternalIds } from './programExternalIdHelpers.ts';
import {
  AllProgramJoins,
  ProgramUpsertFields,
  selectProgramsBuilder,
  withProgramByExternalId,
  withProgramExternalIds,
  withProgramGroupingExternalIds,
  withTrackAlbum,
  withTrackArtist,
  withTvSeason,
  withTvShow,
} from './programQueryHelpers.ts';
import {
  NewProgramDao as NewRawProgram,
  ProgramType,
  ProgramDao as RawProgram,
  programExternalIdString,
} from './schema/Program.ts';
import {
  MinimalProgramExternalId,
  NewProgramExternalId,
  NewProgramExternalId as NewRawProgramExternalId,
  ProgramExternalId,
  ProgramExternalIdKeys,
} from './schema/ProgramExternalId.ts';
import {
  NewProgramGrouping,
  ProgramGroupingType,
} from './schema/ProgramGrouping.ts';
import { NewProgramGroupingExternalId } from './schema/ProgramGroupingExternalId.ts';
import { DB } from './schema/db.ts';
import {
  ProgramGroupingWithExternalIds,
  ProgramWithRelations,
} from './schema/derivedTypes.js';

type ValidatedContentProgram = MarkRequired<
  ContentProgram,
  'externalSourceName' | 'externalSourceType'
>;

type MintedRawProgramInfo = {
  program: NewRawProgram;
  externalIds: NewRawProgramExternalId[];
  apiProgram: ValidatedContentProgram;
};

type ContentProgramWithHierarchy = Omit<
  MarkRequired<ContentProgram, 'grandparent' | 'parent'>,
  'subtype'
> & {
  subtype: 'episode' | 'track';
};

type ProgramRelationCaseBuilder = CaseWhenBuilder<
  DB,
  'program',
  unknown,
  string | null
>;

@injectable()
export class ProgramDB implements IProgramDB {
  private timer: Timer; // = new Timer(this.logger);

  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(ProgramConverter) private programConverter: ProgramConverter,
  ) {
    this.timer = new Timer(this.logger);
  }

  async getProgramById(id: string) {
    return getDatabase()
      .selectFrom('program')
      .selectAll()
      .select((eb) => withProgramExternalIds(eb, ProgramExternalIdKeys))
      .where('program.uuid', '=', id)
      .executeTakeFirst();
  }

  async getProgramExternalIds(
    id: string,
    externalIdTypes?: ProgramExternalIdType[],
  ) {
    return await getDatabase()
      .selectFrom('programExternalId')
      .selectAll()
      .where('programExternalId.programUuid', '=', id)
      .$if(!isEmpty(externalIdTypes), (qb) =>
        qb.where('programExternalId.sourceType', 'in', externalIdTypes!),
      )
      .execute();
  }

  async getShowIdFromTitle(title: string) {
    const matchedGrouping = await getDatabase()
      .selectFrom('programGrouping')
      .select('uuid')
      .where('title', '=', title)
      .where('type', '=', ProgramGroupingType.Show)
      .executeTakeFirst();

    return matchedGrouping?.uuid;
  }

  async updateProgramDuration(programId: string, duration: number) {
    await getDatabase()
      .updateTable('program')
      .where('uuid', '=', programId)
      .set({
        duration,
      })
      .executeTakeFirst();
  }

  async getProgramsByIds(
    ids: string[],
    batchSize: number = 500,
  ): Promise<ProgramWithRelations[]> {
    const results: ProgramWithRelations[] = [];
    for (const idChunk of chunk(ids, batchSize)) {
      const res = await getDatabase()
        .selectFrom('program')
        .selectAll()
        .select(withTrackAlbum)
        .select(withTrackArtist)
        .select(withTvSeason)
        .select(withTvShow)
        .select(withProgramExternalIds)
        .where('program.uuid', 'in', idChunk)
        .execute();
      results.push(...res);
    }
    return results;
  }

  async getProgramGrouping(id: string) {
    return getDatabase()
      .selectFrom('programGrouping')
      .selectAll()
      .select(withProgramGroupingExternalIds)
      .where('uuid', '=', id)
      .executeTakeFirst();
  }

  async getProgramParent(
    programId: string,
  ): Promise<Maybe<ProgramGroupingWithExternalIds>> {
    const p = await selectProgramsBuilder({
      joins: { tvSeason: true, trackAlbum: true },
    })
      .where('program.uuid', '=', programId)
      .executeTakeFirst()
      .then((program) => program?.tvSeason ?? program?.trackAlbum);

    // It would be better if we didn'thave to do this in two queries...
    if (p) {
      const eids = await getDatabase()
        .selectFrom('programGroupingExternalId')
        .where('groupUuid', '=', p.uuid)
        .selectAll()
        .execute();
      return {
        ...p,
        externalIds: eids,
      };
    }

    return;
  }

  async lookupByExternalId(eid: {
    sourceType: ProgramSourceType;
    externalSourceId: string;
    externalKey: string;
  }) {
    return first(
      values(
        await this.lookupByExternalIds(
          new Set([[eid.sourceType, eid.externalSourceId, eid.externalKey]]),
        ),
      ),
    );
  }

  async lookupByExternalIds(ids: Set<[string, string, string]>) {
    const allIds = [...ids];
    const programsByExternalIds: ProgramWithRelations[] = [];
    for (const idChunk of chunk(allIds, 200)) {
      programsByExternalIds.push(
        ...(await getDatabase()
          .selectFrom('programExternalId')
          .select((eb) =>
            withProgramByExternalId(eb, { joins: AllProgramJoins }),
          )
          .where((eb) =>
            eb.or(
              map(idChunk, ([ps, es, ek]) =>
                eb.and([
                  eb('programExternalId.externalKey', '=', ek),
                  eb('programExternalId.externalSourceId', '=', es),
                  eb(
                    'programExternalId.sourceType',
                    '=',
                    programSourceTypeFromString(ps)!,
                  ),
                ]),
              ),
            ),
          )
          .execute()
          .then((_) => seq.collect(_, (eid) => eid.program))),
      );
    }

    return groupByUniq(
      map(programsByExternalIds, (program) =>
        this.programConverter.programDaoToContentProgram(
          program,
          program.externalIds ?? [],
        ),
      ),
      (item) => item.id!,
    );
  }

  async programIdsByExternalIds(
    ids: Set<[string, string, string]>,
    chunkSize: number = 50,
  ) {
    if (ids.size === 0) {
      return {};
    }

    const externalIds = await flatMapAsyncSeq(
      chunk([...ids], chunkSize),
      (idChunk) => {
        return getDatabase()
          .selectFrom('programExternalId')
          .selectAll()
          .where((eb) =>
            eb.or(
              map(idChunk, ([ps, es, ek]) => {
                return eb.and([
                  eb('programExternalId.externalKey', '=', ek),
                  eb('programExternalId.externalSourceId', '=', es),
                  eb(
                    'programExternalId.sourceType',
                    '=',
                    programSourceTypeFromString(ps)!,
                  ),
                ]);
              }),
            ),
          )
          .execute();
      },
    );

    return mapValues(
      groupByUniq(externalIds, (eid) =>
        createExternalId(
          eid.sourceType,
          eid.externalSourceId!,
          eid.externalKey,
        ),
      ),
      (eid) => eid.programUuid,
    );
  }

  async updateProgramPlexRatingKey(
    programId: string,
    plexServerName: string,
    details: MarkOptional<
      Pick<
        ProgramExternalId,
        'externalKey' | 'directFilePath' | 'externalFilePath'
      >,
      'directFilePath' | 'externalFilePath'
    >,
  ) {
    const existingRatingKey = await getDatabase()
      .selectFrom('programExternalId')
      .selectAll()
      .where((eb) =>
        eb.and({
          programUuid: programId,
          externalSourceId: plexServerName,
          sourceType: ProgramExternalIdType.PLEX,
        }),
      )
      .executeTakeFirst();

    if (isNil(existingRatingKey)) {
      const now = +dayjs();
      return await getDatabase()
        .insertInto('programExternalId')
        .values({
          uuid: v4(),
          createdAt: now,
          updatedAt: now,
          programUuid: programId,
          sourceType: ProgramExternalIdType.PLEX,
          externalSourceId: plexServerName,
          ...details,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    } else {
      await getDatabase()
        .updateTable('programExternalId')
        .set({
          externalKey: details.externalKey,
        })
        .$if(isNonEmptyString(details.externalFilePath), (_) =>
          _.set({
            externalFilePath: details.externalFilePath!,
          }),
        )
        .$if(isNonEmptyString(details.directFilePath), (_) =>
          _.set({
            directFilePath: details.directFilePath!,
          }),
        )
        .where('uuid', '=', existingRatingKey.uuid)
        .executeTakeFirst();
      return await getDatabase()
        .selectFrom('programExternalId')
        .selectAll()
        .where('uuid', '=', existingRatingKey.uuid)
        .executeTakeFirstOrThrow();
    }
  }

  async replaceProgramExternalId(
    programId: string,
    newExternalId: NewProgramExternalId,
    oldExternalId?: MinimalProgramExternalId,
  ) {
    await getDatabase()
      .transaction()
      .execute(async (tx) => {
        if (oldExternalId) {
          await tx
            .deleteFrom('programExternalId')
            .where('programExternalId.programUuid', '=', programId)
            .where(
              'programExternalId.externalKey',
              '=',
              oldExternalId.externalKey,
            )
            .where(
              'programExternalId.externalSourceId',
              '=',
              oldExternalId.externalSourceId,
            )
            .where(
              'programExternalId.sourceType',
              '=',
              oldExternalId.sourceType,
            )
            .limit(1)
            .execute();
        }
        await tx
          .insertInto('programExternalId')
          .values(newExternalId)
          .execute();
      });
  }

  async upsertContentPrograms(
    programs: ChannelProgram[],
    programUpsertBatchSize: number = 100,
  ) {
    const start = performance.now();
    // TODO: Wrap all of this stuff in a class and use its own logger
    const [, nonPersisted] = partition(programs, (p) => p.persisted);
    const minter = ProgramMinterFactory.create();

    const [contentPrograms, invalidPrograms] = partition(
      uniqBy(filter(nonPersisted, isContentProgram), (p) => p.uniqueId),
      (p): p is ValidatedContentProgram =>
        isNonEmptyString(p.externalSourceType) &&
        isNonEmptyString(p.externalSourceName) &&
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

    // This code dedupes incoming programs using their external (IMDB, TMDB, etc) IDs.
    // Eventually, it could be used to save source-agnostic programs, but it's unclear
    // if that gives us benefit yet.
    // const pMap = reduce(
    //   contentPrograms,
    //   (acc, program) => {
    //     const externalIds: {
    //       type: ProgramExternalIdType;
    //       id: string;
    //       program: ContentProgram;
    //     }[] = [];
    //     switch (program.originalProgram!.sourceType) {
    //       case 'plex': {
    //         const x = ld
    //           .chain(program.originalProgram!.program.Guid ?? [])
    //           .map((guid) => parsePlexExternalGuid(guid.id))
    //           .thru(removeErrors)
    //           .map((eid) => ({
    //             type: eid.sourceType,
    //             id: eid.externalKey,
    //             program,
    //           }))
    //           .value();
    //         externalIds.push(...x);
    //         break;
    //       }
    //       case 'jellyfin': {
    //         const p = compact(
    //           map(program.originalProgram!.program.ProviderIds, (value, key) => {
    //             const typ = programExternalIdTypeFromString(key.toLowerCase());
    //             return isNil(value) || isUndefined(typ)
    //               ? null
    //               : { type: typ, id: value, program };
    //           }),
    //         );
    //         externalIds.push(...p);
    //         break;
    //       }
    //     }

    //     forEach(externalIds, ({ type, id, program }) => {
    //       if (!isValidSingleExternalIdType(type)) {
    //         return;
    //       }

    //       const key = createGlobalExternalIdString(type, id);
    //       const last = acc[key];
    //       if (last) {
    //         acc[key] = { type, id, programs: [...last.programs, program] };
    //       } else {
    //         acc[key] = { type, id, programs: [program] };
    //       }
    //     });

    //     return acc;
    //   },
    //   {} as Record<
    //     `${string}|${string}`,
    //     {
    //       type: ProgramExternalIdType;
    //       id: string;
    //       programs: ContentProgram[];
    //     }
    //   >,
    // );

    // TODO: handle custom shows
    const programsToPersist: MintedRawProgramInfo[] = map(
      contentPrograms,
      (p) => {
        const program = minter.contentProgramDtoToDao(p);
        const externalIds = minter.mintExternalIds(
          p.externalSourceName,
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

    // TODO: The way we deal with uniqueness right now makes a Program entity
    // exist 1:1 with its "external" entity, i.e. the same logical movie will
    // have duplicate entries in the DB across different servers and sources.
    const upsertedPrograms: RawProgram[] = [];
    await this.timer.timeAsync('programUpsert', async () => {
      for (const c of chunk(programsToPersist, programUpsertBatchSize)) {
        upsertedPrograms.push(
          ...(await getDatabase()
            .transaction()
            .execute((tx) =>
              tx
                .insertInto('program')
                .values(map(c, 'program'))
                .onConflict((oc) =>
                  oc
                    .columns(['sourceType', 'externalSourceId', 'externalKey'])
                    .doUpdateSet((eb) =>
                      mapToObj(ProgramUpsertFields, (f) => ({
                        [f.replace('excluded.', '')]: eb.ref(f),
                      })),
                    ),
                )
                .returningAll()
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
      (p) =>
        p.sourceType === ProgramExternalIdType.PLEX ||
        // p.sourceType === ProgramExternalIdType.PLEX_GUID ||
        p.sourceType === ProgramExternalIdType.JELLYFIN,
    );

    // Fail hard on not saving Plex / Jellyfin program external IDs. We need them for streaming
    // TODO: We could optimize further here by only saving IDs necessary for streaming
    await this.timer.timeAsync(
      `upsert ${requiredExternalIds.length} external ids`,
      () => upsertRawProgramExternalIds(requiredExternalIds, 200),
      // upsertProgramExternalIds_deprecated(requiredExternalIds),
    );

    this.schedulePlexExternalIdsTask(upsertedPrograms);
    this.scheduleJellyfinExternalIdsTask(upsertedPrograms);

    setImmediate(() => {
      this.logger.debug('Scheduling follow-up program tasks...');

      GlobalScheduler.scheduleOneOffTask(
        ReconcileProgramDurationsTask.KEY,
        dayjs().add(500, 'ms'),
      );

      PlexTaskQueue.resume();
      JellyfinTaskQueue.resume();

      this.logger.debug('Upserting external IDs in background');

      GlobalScheduler.scheduleOneOffTask(
        'UpsertExternalIds',
        dayjs().add(100),
        AnonymousTask('UpsertExternalIds', () =>
          this.timer.timeAsync(
            `background external ID upsert (${backgroundExternalIds.length} ids)`,
            () => upsertRawProgramExternalIds(backgroundExternalIds),
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

  private async handleProgramGroupings(
    upsertedPrograms: RawProgram[],
    programInfos: Record<string, MintedRawProgramInfo>,
  ) {
    const programsBySourceAndServer = mapValues(
      groupBy(upsertedPrograms, 'sourceType'),
      (ps) => groupBy(ps, 'externalSourceId'),
    );

    for (const [sourceType, byServerName] of Object.entries(
      programsBySourceAndServer,
    )) {
      for (const [serverName, programs] of Object.entries(byServerName)) {
        // This is just extra safety because lodash erases the type in groupBy
        const typ = programSourceTypeFromString(sourceType);
        if (!typ) {
          return;
        }

        await this.handleSingleSourceProgramGroupings(
          programs,
          programInfos,
          typ,
          serverName,
        );
      }
    }
  }

  private async handleSingleSourceProgramGroupings(
    upsertedPrograms: RawProgram[],
    programInfos: Record<string, MintedRawProgramInfo>,
    mediaSourceType: ProgramSourceType,
    mediaSourceId: string,
  ) {
    const grandparentRatingKeyToParentRatingKey: Record<
      string,
      Set<string>
    > = {};
    const grandparentRatingKeyToProgramId: Record<string, Set<string>> = {};
    const parentRatingKeyToProgramId: Record<string, Set<string>> = {};

    const relevantPrograms: [
      RawProgram,
      ContentProgramWithHierarchy & {
        grandparentKey: string;
        parentKey: string;
      },
    ][] = seq.collect(upsertedPrograms, (program) => {
      if (program.type === ProgramType.Movie) {
        return;
      }

      const info = programInfos[programExternalIdString(program)];
      if (!info) {
        return;
      }

      if (info.apiProgram.subtype === 'movie') {
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

      return [
        program,
        {
          ...(info.apiProgram as ContentProgramWithHierarchy),
          grandparentKey,
          parentKey,
        },
      ] as const;
    });

    const upsertedProgramById = groupByUniqProp(
      map(relevantPrograms, ([program]) => program),
      'uuid',
    );

    for (const [program, { grandparentKey, parentKey }] of relevantPrograms) {
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
        getDatabase()
          .selectFrom('programGroupingExternalId')
          .where((eb) => {
            return eb.and([
              eb('programGroupingExternalId.sourceType', '=', mediaSourceType),
              eb(
                'programGroupingExternalId.externalSourceId',
                '=',
                mediaSourceId,
              ),
              eb(
                'programGroupingExternalId.externalKey',
                'in',
                allGroupingKeys,
              ),
            ]);
          })
          .innerJoin(
            'programGrouping',
            'programGroupingExternalId.groupUuid',
            'programGrouping.uuid',
          )
          .selectAll()
          .groupBy([
            'programGroupingExternalId.externalKey',
            'programGrouping.uuid',
          ])
          .execute(),
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
      for (const [
        upsertedProgram,
        { grandparentKey, parentKey },
      ] of relevantPrograms) {
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
          }
        }
      }
    }

    // New ones
    const groupings: NewProgramGrouping[] = [];
    const externalIds: NewProgramGroupingExternalId[] = [];
    for (const missingGrandparent of missingGrandparents) {
      const matchingPrograms = filter(
        relevantPrograms,
        ([, { grandparentKey }]) => grandparentKey === missingGrandparent,
      );

      if (isEmpty(matchingPrograms)) {
        continue;
      }

      const grandparentGrouping = ProgramGroupingMinter.mintGrandparentGrouping(
        matchingPrograms[0][1],
      );

      if (isNull(grandparentGrouping)) {
        devAssert(false);
        continue;
      }

      matchingPrograms.forEach(([program]) => {
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

        const programs = filter(relevantPrograms, ([program]) =>
          programIds.has(program.uuid),
        );

        // Also should never happen...
        if (isEmpty(programs)) {
          devAssert(false);
          continue;
        }

        devAssert(() => uniq(map(programs, ([p]) => p.type)).length === 1);

        const parentGrouping = ProgramGroupingMinter.mintParentGrouping(
          programs[0][1],
        );

        if (!parentGrouping) {
          continue;
        }

        programs.forEach(([program]) => {
          if (program.type === ProgramType.Episode) {
            program.seasonUuid = parentGrouping.uuid;
            updatesByType[ProgramGroupingType.Season].add(program.uuid);
          } else {
            program.albumUuid = parentGrouping.uuid;
            updatesByType[ProgramGroupingType.Album].add(program.uuid);
          }
        });

        if (parentGrouping.type === ProgramGroupingType.Show) {
          parentGrouping.showUuid = grandparentGrouping.uuid;
        } else if (parentGrouping.type === ProgramGroupingType.Album) {
          parentGrouping.artistUuid = grandparentGrouping.uuid;
        }

        groupings.push(parentGrouping);
        externalIds.push(
          ...ProgramGroupingMinter.mintGroupingExternalIds(
            programs[0][1],
            parentGrouping.uuid,
            mediaSourceId,
            'parent',
          ),
        );
      }

      groupings.push(grandparentGrouping);
      externalIds.push(
        ...ProgramGroupingMinter.mintGroupingExternalIds(
          matchingPrograms[0][1],
          grandparentGrouping.uuid,
          mediaSourceId,
          'grandparent',
        ),
      );
    }

    if (!isEmpty(groupings)) {
      await this.timer.timeAsync('upsert program_groupings', () =>
        getDatabase()
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
        getDatabase()
          .transaction()
          .execute((tx) =>
            tx
              .insertInto('programGroupingExternalId')
              .values(externalIds)
              .executeTakeFirstOrThrow(),
          ),
      );
    }

    const hasUpdates = some(updatesByType, (updates) => updates.size > 0);

    if (hasUpdates) {
      // Surprisingly it's faster to do these all at once...
      await this.timer.timeAsync('update program relations', () =>
        getDatabase()
          .transaction()
          .execute(async (tx) => {
            // For each program, we produce 3 SQL variables: when = ?, then = ?, and uuid in [?].
            // We have to chunk by type in order to ensure we don't go over the variable limit
            const tvShowIdUpdates = [
              ...updatesByType[ProgramGroupingType.Show],
            ];

            if (!isEmpty(tvShowIdUpdates)) {
              // Should produce up to 30_000 variables each iteration...
              for (const idChunk of chunk(tvShowIdUpdates, 10_000)) {
                await tx
                  .updateTable('program')
                  .set((eb) => ({
                    tvShowUuid: reduce(
                      idChunk,
                      (acc, curr) =>
                        acc
                          .when('program.uuid', '=', curr)
                          .then(upsertedProgramById[curr].tvShowUuid),
                      eb.case() as unknown as ProgramRelationCaseBuilder,
                    )
                      .else(eb.ref('program.tvShowUuid'))
                      .end(),
                  }))
                  .where('program.uuid', 'in', idChunk)
                  .execute();
              }
            }

            const seasonIdUpdates = [
              ...updatesByType[ProgramGroupingType.Season],
            ];

            if (!isEmpty(seasonIdUpdates)) {
              // Should produce up to 30_000 variables each iteration...
              for (const idChunk of chunk(seasonIdUpdates, 10_000)) {
                await tx
                  .updateTable('program')
                  .set((eb) => ({
                    seasonUuid: reduce(
                      idChunk,
                      (acc, curr) =>
                        acc
                          .when('program.uuid', '=', curr)
                          .then(upsertedProgramById[curr].seasonUuid),
                      eb.case() as unknown as ProgramRelationCaseBuilder,
                    )
                      .else(eb.ref('program.seasonUuid'))
                      .end(),
                  }))
                  .where('program.uuid', 'in', idChunk)
                  .execute();
              }
            }

            const musicArtistUpdates = [
              ...updatesByType[ProgramGroupingType.Artist],
            ];

            if (!isEmpty(musicArtistUpdates)) {
              // Should produce up to 30_000 variables each iteration...
              for (const idChunk of chunk(musicArtistUpdates, 10_000)) {
                await tx
                  .updateTable('program')
                  .set((eb) => ({
                    artistUuid: reduce(
                      idChunk,
                      (acc, curr) =>
                        acc
                          .when('program.uuid', '=', curr)
                          .then(upsertedProgramById[curr].artistUuid),
                      eb.case() as unknown as ProgramRelationCaseBuilder,
                    )
                      .else(eb.ref('program.artistUuid'))
                      .end(),
                  }))
                  .where('program.uuid', 'in', idChunk)
                  .execute();
              }
            }

            const musicAlbumUpdates = [
              ...updatesByType[ProgramGroupingType.Album],
            ];

            if (!isEmpty(musicAlbumUpdates)) {
              // Should produce up to 30_000 variables each iteration...
              for (const idChunk of chunk(musicAlbumUpdates, 10_000)) {
                await tx
                  .updateTable('program')
                  .set((eb) => ({
                    albumUuid: reduce(
                      idChunk,
                      (acc, curr) =>
                        acc
                          .when('program.uuid', '=', curr)
                          .then(upsertedProgramById[curr].albumUuid),
                      eb.case() as unknown as ProgramRelationCaseBuilder,
                    )
                      .else(eb.ref('program.albumUuid'))
                      .end(),
                  }))
                  .where('program.uuid', 'in', idChunk)
                  .execute();
              }
            }
          }),
      );
    }
  }

  private schedulePlexExternalIdsTask(upsertedPrograms: NewRawProgram[]) {
    PlexTaskQueue.pause();
    this.timer.timeSync('schedule Plex external IDs tasks', () => {
      forEach(
        filter(upsertedPrograms, { sourceType: ProgramSourceType.PLEX }),
        (program) => {
          try {
            const task = new SavePlexProgramExternalIdsTask(program.uuid, this);
            task.logLevel = 'trace';
            PlexTaskQueue.add(task).catch((e) => {
              this.logger.error(
                e,
                'Error saving external IDs for program %s',
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

  private scheduleJellyfinExternalIdsTask(upsertedPrograms: NewRawProgram[]) {
    JellyfinTaskQueue.pause();
    this.timer.timeSync('Schedule Jellyfin external IDs tasks', () => {
      forEach(
        filter(
          upsertedPrograms,
          (p) => p.sourceType === ProgramSourceType.JELLYFIN,
        ),
        (program) => {
          try {
            const task = new SaveJellyfinProgramExternalIdsTask(
              program.uuid,
              this,
            );
            JellyfinTaskQueue.add(task).catch((e) => {
              this.logger.error(
                e,
                'Error saving external IDs for program %s',
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
}
