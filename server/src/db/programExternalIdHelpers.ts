import { mapAsyncSeq } from '@/util/index.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { chunk, flatten, isEmpty, partition } from 'lodash-es';
import { getDatabase } from './DBAccess.ts';
import {
  toInsertableProgramExternalId,
  type NewSingleOrMultiExternalId,
} from './schema/ProgramExternalId.ts';

export const upsertProgramExternalIds = async (
  externalIds: NewSingleOrMultiExternalId[],
  chunkSize: number = 100,
) => {
  if (isEmpty(externalIds)) {
    return;
  }

  const logger = LoggerFactory.root;

  const [singles, multiples] = partition(
    externalIds,
    (id) => id.type === 'single',
  );

  let singleIdPromise: Promise<{ uuid: string }[]>;
  if (!isEmpty(singles)) {
    singleIdPromise = mapAsyncSeq(chunk(singles, chunkSize), (singleChunk) => {
      return getDatabase()
        .transaction()
        .execute((tx) =>
          tx
            .insertInto('programExternalId')
            .values(singleChunk.map(toInsertableProgramExternalId))
            .onConflict((oc) =>
              oc
                .columns(['programUuid', 'sourceType'])
                .where('externalSourceId', 'is', null)
                .doUpdateSet((eb) => ({
                  updatedAt: eb.ref('excluded.updatedAt'),
                  externalFilePath: eb.ref('excluded.externalFilePath'),
                  directFilePath: eb.ref('excluded.directFilePath'),
                  programUuid: eb.ref('excluded.programUuid'),
                })),
            )
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
            .returning('uuid as uuid')
            .execute(),
        );
    }).then(flatten);
  } else {
    singleIdPromise = Promise.resolve([]);
  }

  let multiIdPromise: Promise<{ uuid: string }[]>;
  if (!isEmpty(multiples)) {
    multiIdPromise = mapAsyncSeq(chunk(multiples, chunkSize), (multiChunk) => {
      return getDatabase()
        .transaction()
        .execute((tx) =>
          tx
            .insertInto('programExternalId')
            .values(multiChunk.map(toInsertableProgramExternalId))
            .onConflict((oc) =>
              oc
                .columns(['programUuid', 'sourceType', 'externalSourceId'])
                .where('externalSourceId', 'is not', null)
                .doUpdateSet((eb) => ({
                  updatedAt: eb.ref('excluded.updatedAt'),
                  externalFilePath: eb.ref('excluded.externalFilePath'),
                  directFilePath: eb.ref('excluded.directFilePath'),
                  programUuid: eb.ref('excluded.programUuid'),
                })),
            )
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
            .returning('uuid as uuid')
            .execute(),
        );
    }).then(flatten);
  } else {
    multiIdPromise = Promise.resolve([]);
  }

  const [singleResult, multiResult] = await Promise.allSettled([
    singleIdPromise,
    multiIdPromise,
  ]);

  if (singleResult.status === 'rejected') {
    logger.error(singleResult.reason, 'Error saving external IDs');
  } else {
    logger.trace('Upserted %d external IDs', singleResult.value.length);
  }

  if (multiResult.status === 'rejected') {
    logger.error(multiResult.reason, 'Error saving external IDs');
  } else {
    logger.trace('Upserted %d external IDs', multiResult.value.length);
  }
};
