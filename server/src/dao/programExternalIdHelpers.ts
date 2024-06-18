import { isValidSingleExternalIdType } from '@tunarr/types/schemas';
import { partition, isUndefined, isEmpty } from 'lodash-es';
import { mapAsyncSeq } from '../util';
import { LoggerFactory } from '../util/logging/LoggerFactory';
import { ProgramExternalId } from './entities/ProgramExternalId';
import { getEm } from './dataSource';

export const upsertProgramExternalIds = async (
  externalIds: ProgramExternalId[],
) => {
  // TODO: Wrap all of this stuff in a class and use its own logger
  const logger = LoggerFactory.root;
  const em = getEm();

  if (isEmpty(externalIds)) {
    return;
  }

  const [singleEids, multiEids] = partition(
    externalIds,
    (eid) =>
      isValidSingleExternalIdType(eid.sourceType) &&
      isUndefined(eid.externalSourceId),
  );

  const knex = em.getConnection().getKnex();

  const eidInserts = mapAsyncSeq(singleEids, async (id) => {
    return knex
      .insert(id.toKnexInsertData())
      .into('program_external_id')
      .onConflict(
        knex.raw(
          '(program_uuid, source_type) WHERE external_source_id IS NULL',
        ),
      )
      .merge()
      .returning('uuid');
  });

  const multiInserts = mapAsyncSeq(multiEids, async (id) => {
    return knex
      .insert(id.toKnexInsertData())
      .into('program_external_id')
      .onConflict(
        knex.raw(
          '(program_uuid, source_type, external_source_id) WHERE external_source_id IS NOT NULL',
        ),
      )
      .merge()
      .returning('uuid');
  });

  const [singleResult, multiResult] = await Promise.allSettled([
    eidInserts,
    multiInserts,
  ]);

  if (singleResult.status === 'rejected') {
    logger.error(singleResult.reason, 'Unable to save single external IDs');
  }

  if (multiResult.status === 'rejected') {
    logger.error(multiResult.reason, 'Unable to save multi external IDs');
  }
};
