import { KEYS } from '@/types/inject.js';
import type { Logger } from '@/util/logging/LoggerFactory.js';
import { seq } from '@tunarr/shared/util';
import { flatMapAsyncSeq, isNonEmptyString } from '../../util/index.ts';
import { createExternalId } from '@tunarr/shared';
import { inject, injectable } from 'inversify';
import type { Kysely } from 'kysely';
import { chunk, first, isEmpty, isNil, last, map, mapValues } from 'lodash-es';
import type { MarkOptional, MarkRequired } from 'ts-essentials';
import dayjs from 'dayjs';
import { v4 } from 'uuid';
import { ProgramExternalIdType } from '../custom_types/ProgramExternalIdType.ts';
import { programSourceTypeFromString } from '../custom_types/ProgramSourceType.ts';
import {
  withProgramByExternalId,
} from '../programQueryHelpers.ts';
import type {
  MinimalProgramExternalId,
  NewProgramExternalId,
  NewSingleOrMultiExternalId,
  ProgramExternalId,
} from '../schema/ProgramExternalId.ts';
import { toInsertableProgramExternalId } from '../schema/ProgramExternalId.ts';
import type { MediaSourceId, RemoteSourceType } from '../schema/base.ts';
import type { DB } from '../schema/db.ts';
import type {
  ProgramWithRelationsOrm,
} from '../schema/derivedTypes.ts';
import type { DrizzleDBAccess } from '../schema/index.ts';
import type { ProgramType } from '../schema/Program.ts';
import { groupByUniq } from '../../util/index.ts';
import type { RemoteMediaSourceType } from '../schema/MediaSource.ts';
import type { ProgramDao } from '../schema/Program.ts';
import type { Dictionary } from 'ts-essentials';
import { groupBy, flatten, partition } from 'lodash-es';
import { mapAsyncSeq } from '../../util/index.ts';

@injectable()
export class ProgramExternalIdRepository {
  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(KEYS.Database) private db: Kysely<DB>,
    @inject(KEYS.DrizzleDB) private drizzleDB: DrizzleDBAccess,
  ) {}

  async lookupByExternalId(eid: {
    sourceType: RemoteSourceType;
    externalSourceId: MediaSourceId;
    externalKey: string;
  }) {
    return first(
      await this.lookupByExternalIds(
        new Set([[eid.sourceType, eid.externalSourceId, eid.externalKey]]),
      ),
    );
  }

  async lookupByExternalIds(
    ids:
      | Set<[RemoteSourceType, MediaSourceId, string]>
      | Set<readonly [RemoteSourceType, MediaSourceId, string]>,
    chunkSize: number = 200,
  ) {
    const allIds = [...ids];
    const programs: MarkRequired<ProgramWithRelationsOrm, 'externalIds'>[] = [];
    for (const idChunk of chunk(allIds, chunkSize)) {
      const results = await this.drizzleDB.query.programExternalId.findMany({
        where: (fields, { or, and, eq }) => {
          const ands = idChunk.map(([ps, es, ek]) =>
            and(
              eq(fields.externalKey, ek),
              eq(fields.sourceType, ps),
              eq(fields.mediaSourceId, es),
            ),
          );
          return or(...ands);
        },
        with: {
          program: {
            with: {
              album: true,
              artist: true,
              season: true,
              show: true,
              externalIds: true,
              tags: {
                with: {
                  tag: true,
                },
              },
              artwork: true,
              credits: true,
              genres: {
                with: {
                  genre: true,
                },
              },
              studios: {
                with: {
                  studio: true,
                },
              },
              versions: true,
            },
          },
        },
      });
      programs.push(...seq.collect(results, (r) => r.program));
    }

    return programs;
  }

  async lookupByMediaSource(
    sourceType: RemoteMediaSourceType,
    sourceId: MediaSourceId,
    programType: ProgramType | undefined,
    chunkSize: number = 200,
  ): Promise<ProgramDao[]> {
    const programs: ProgramDao[] = [];
    let chunk: ProgramDao[] = [];
    let lastId: string | undefined;
    do {
      const result = await this.db
        .selectFrom('programExternalId')
        .select('programExternalId.uuid')
        .select((eb) =>
          withProgramByExternalId(eb, { joins: {} }, (qb) =>
            qb.$if(!!programType, (eb) =>
              eb.where('program.type', '=', programType!),
            ),
          ),
        )
        .where('programExternalId.sourceType', '=', sourceType)
        .where('programExternalId.mediaSourceId', '=', sourceId)
        .$if(!!lastId, (x) => x.where('programExternalId.uuid', '>', lastId!))
        .orderBy('programExternalId.uuid asc')
        .limit(chunkSize)
        .execute();
      chunk = seq.collect(result, (eid) => eid.program);
      programs.push(...chunk);
      lastId = last(result)?.uuid;
    } while (chunk.length > 0);

    return programs;
  }

  async programIdsByExternalIds(
    ids: Set<[string, MediaSourceId, string]>,
    chunkSize: number = 50,
  ) {
    if (ids.size === 0) {
      return {};
    }

    const externalIds = await flatMapAsyncSeq(
      chunk([...ids], chunkSize),
      (idChunk) => {
        return this.db
          .selectFrom('programExternalId')
          .selectAll()
          .where((eb) =>
            eb.or(
              map(idChunk, ([ps, es, ek]) => {
                return eb.and([
                  eb('programExternalId.externalKey', '=', ek),
                  eb('programExternalId.mediaSourceId', '=', es),
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
        createExternalId(eid.sourceType, eid.mediaSourceId!, eid.externalKey),
      ),
      (eid) => eid.programUuid,
    );
  }

  async updateProgramPlexRatingKey(
    programId: string,
    serverId: MediaSourceId,
    details: MarkOptional<
      Pick<
        ProgramExternalId,
        'externalKey' | 'directFilePath' | 'externalFilePath'
      >,
      'directFilePath' | 'externalFilePath'
    >,
  ) {
    const existingRatingKey = await this.db
      .selectFrom('programExternalId')
      .selectAll()
      .where((eb) =>
        eb.and({
          programUuid: programId,
          mediaSourceId: serverId,
          sourceType: ProgramExternalIdType.PLEX,
        }),
      )
      .executeTakeFirst();

    if (isNil(existingRatingKey)) {
      const now = +dayjs();
      return await this.db
        .insertInto('programExternalId')
        .values({
          uuid: v4(),
          createdAt: now,
          updatedAt: now,
          programUuid: programId,
          sourceType: ProgramExternalIdType.PLEX,
          mediaSourceId: serverId,
          ...details,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    } else {
      await this.db
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
      return await this.db
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
    await this.db.transaction().execute(async (tx) => {
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
          .where('programExternalId.sourceType', '=', oldExternalId.sourceType)
          .execute();
      }
      await tx.insertInto('programExternalId').values(newExternalId).execute();
    });
  }

  async upsertProgramExternalIds(
    externalIds: NewSingleOrMultiExternalId[],
    chunkSize: number = 100,
  ): Promise<Dictionary<ProgramExternalId[]>> {
    if (isEmpty(externalIds)) {
      return {};
    }

    const logger = this.logger;

    const [singles, multiples] = partition(
      externalIds,
      (id) => id.type === 'single',
    );

    let singleIdPromise: Promise<ProgramExternalId[]>;
    if (!isEmpty(singles)) {
      singleIdPromise = mapAsyncSeq(
        chunk(singles, chunkSize),
        (singleChunk) => {
          return this.db.transaction().execute((tx) =>
            tx
              .insertInto('programExternalId')
              .values(singleChunk.map(toInsertableProgramExternalId))
              .onConflict((oc) =>
                oc
                  .columns(['programUuid', 'sourceType'])
                  .where('mediaSourceId', 'is', null)
                  .doUpdateSet((eb) => ({
                    updatedAt: eb.ref('excluded.updatedAt'),
                    externalFilePath: eb.ref('excluded.externalFilePath'),
                    directFilePath: eb.ref('excluded.directFilePath'),
                    programUuid: eb.ref('excluded.programUuid'),
                  })),
              )
              .returningAll()
              .execute(),
          );
        },
      ).then(flatten);
    } else {
      singleIdPromise = Promise.resolve([]);
    }

    let multiIdPromise: Promise<ProgramExternalId[]>;
    if (!isEmpty(multiples)) {
      multiIdPromise = mapAsyncSeq(
        chunk(multiples, chunkSize),
        (multiChunk) => {
          return this.db.transaction().execute((tx) =>
            tx
              .insertInto('programExternalId')
              .values(multiChunk.map(toInsertableProgramExternalId))
              .onConflict((oc) =>
                oc
                  .columns(['programUuid', 'sourceType', 'mediaSourceId'])
                  .where('mediaSourceId', 'is not', null)
                  .doUpdateSet((eb) => ({
                    updatedAt: eb.ref('excluded.updatedAt'),
                    externalFilePath: eb.ref('excluded.externalFilePath'),
                    directFilePath: eb.ref('excluded.directFilePath'),
                    programUuid: eb.ref('excluded.programUuid'),
                  })),
              )
              .returningAll()
              .execute(),
          );
        },
      ).then(flatten);
    } else {
      multiIdPromise = Promise.resolve([]);
    }

    const [singleResult, multiResult] = await Promise.allSettled([
      singleIdPromise,
      multiIdPromise,
    ]);

    const allExternalIds: ProgramExternalId[] = [];
    if (singleResult.status === 'rejected') {
      logger.error(singleResult.reason, 'Error saving external IDs');
    } else {
      logger.trace('Upserted %d external IDs', singleResult.value.length);
      allExternalIds.push(...singleResult.value);
    }

    if (multiResult.status === 'rejected') {
      logger.error(multiResult.reason, 'Error saving external IDs');
    } else {
      logger.trace('Upserted %d external IDs', multiResult.value.length);
      allExternalIds.push(...multiResult.value);
    }

    return groupBy(allExternalIds, (eid) => eid.programUuid);
  }
}
