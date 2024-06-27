import { isValidSingleExternalIdType } from '@tunarr/types/schemas';
import {
  chunk,
  forEach,
  isEmpty,
  isUndefined,
  map,
  partition,
} from 'lodash-es';
import { v4 } from 'uuid';
import { groupByUniqFunc, mapAsyncSeq } from '../util';
import { LoggerFactory } from '../util/logging/LoggerFactory';
import { getEm } from './dataSource';
import { ProgramExternalId } from './entities/ProgramExternalId';

// Leaving this around for now to document using the indexes for insert
export const upsertProgramExternalIds_deprecated = async (
  externalIds: ProgramExternalId[],
) => {
  // TODO: Wrap all of this stuff in a class and use its own logger
  const logger = LoggerFactory.root;
  const em = getEm();

  if (isEmpty(externalIds)) {
    return;
  }

  const knex = em.getConnection().getKnex();

  // TODO: Once https://github.com/mikro-orm/mikro-orm/pull/5691 is
  // available in mikro-orm we should upgrade this.
  // const eidInserts = asyncPool(
  //   externalIds,
  //   async (id) => {
  //     const isSingle =
  //       isValidSingleExternalIdType(id.sourceType) &&
  //       isUndefined(id.externalSourceId);
  //     const onConflict = isSingle
  //       ? '(program_uuid, source_type) WHERE external_source_id IS NULL'
  //       : '(program_uuid, source_type, external_source_id) WHERE external_source_id IS NOT NULL';
  //     return knex
  //       .insert(id.toKnexInsertData())
  //       .into('program_external_id')
  //       .onConflict(knex.raw(onConflict))
  //       .merge()
  //       .returning('uuid');
  //   },
  //   { concurrency: 10 },
  // );

  const [singles, multiples] = partition(
    externalIds,
    (id) =>
      isValidSingleExternalIdType(id.sourceType) &&
      isUndefined(id.externalSourceId),
  );

  const singlesPromise =
    singles.length > 0
      ? mapAsyncSeq(chunk(singles, 200), (singleIds) => {
          return knex.transaction((tx) =>
            tx
              .insert(singleIds.map((id) => id.toKnexInsertData()))
              .into('program_external_id')
              .onConflict(
                knex.raw(
                  '(program_uuid, source_type) WHERE external_source_id IS NULL',
                ),
              )
              .merge()
              .returning('uuid'),
          );
        })
      : Promise.resolve([[]]);

  const multiplesPromise =
    multiples.length > 0
      ? mapAsyncSeq(chunk(multiples, 200), (multipleIds) => {
          return knex.transaction((tx) =>
            tx
              .insert(multipleIds.map((id) => id.toKnexInsertData()))
              .into('program_external_id')
              .onConflict(
                knex.raw(
                  '(program_uuid, source_type, external_source_id) WHERE external_source_id IS NOT NULL',
                ),
              )
              .merge()
              .returning('uuid'),
          );
        })
      : Promise.resolve([[]]);

  const [singleResult, multiResult] = await Promise.allSettled([
    singlesPromise,
    multiplesPromise,
  ]);

  if (singleResult.status === 'rejected') {
    logger.error(singleResult.reason, 'Error savingn external IDs');
  }

  if (multiResult.status === 'rejected') {
    logger.error(multiResult.reason, 'Error savingn external IDs');
  }
};

// TODO: Once https://github.com/mikro-orm/mikro-orm/pull/5691 is
// available in mikro-orm we should upgrade this.
export const upsertProgramExternalIds = async (
  externalIds: ProgramExternalId[],
  readBatchSize: number = 100,
) => {
  if (isEmpty(externalIds)) {
    return;
  }

  const logger = LoggerFactory.root;
  const em = getEm();

  const inserts: ProgramExternalId[] = [];
  const updates: ProgramExternalId[] = [];
  await mapAsyncSeq(chunk(externalIds, readBatchSize), async (ids) => {
    const start = performance.now();
    const res = await em.find(ProgramExternalId, {
      $or: [
        map(ids, (id) => ({
          sourceType: id.sourceType,
          externalSourceId: id.externalSourceId ?? null,
          externalKey: id.externalKey,
        })),
      ],
    });
    const end = performance.now();
    logger.debug('Queried batchSize %d in %d ms', readBatchSize, end - start);

    const grouped = groupByUniqFunc(res, (r) => r.toExternalIdString());

    return forEach(ids, (id) => {
      const asStr = id.toExternalIdString();
      const existing = grouped[asStr];
      if (existing) {
        id.uuid = existing.uuid;
        updates.push(id);
      } else {
        id.uuid = v4();
        inserts.push(id);
        em.persist(id);
      }
    });
  });

  const start = performance.now();
  await em.flush();
  const end = performance.now();
  logger.debug(
    'Wrote %d external ieds in %d ms',
    inserts.length + updates.length,
    end - start,
  );
};
