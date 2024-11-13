import { isValidSingleExternalIdType } from '@tunarr/types/schemas';
import { chunk, flatten, isEmpty, isUndefined, partition } from 'lodash-es';
import { mapAsyncSeq } from '../util/index.ts';
import { LoggerFactory } from '../util/logging/LoggerFactory.ts';
import { directDbAccess } from './direct/directDbAccess.ts';
import { NewProgramExternalId as NewRawProgramExternalId } from './direct/schema/ProgramExternalId.ts';

export const upsertRawProgramExternalIds = async (
  externalIds: NewRawProgramExternalId[],
  chunkSize: number = 100,
) => {
  if (isEmpty(externalIds)) {
    return;
  }

  const logger = LoggerFactory.root;

  const [singles, multiples] = partition(
    externalIds,
    (id) =>
      isValidSingleExternalIdType(id.sourceType) &&
      isUndefined(id.externalSourceId),
  );

  let singleIdPromise: Promise<{ uuid: string }[]>;
  if (!isEmpty(singles)) {
    singleIdPromise = mapAsyncSeq(chunk(singles, chunkSize), (singleChunk) => {
      return directDbAccess()
        .transaction()
        .execute((tx) =>
          tx
            .insertInto('programExternalId')
            .values(singleChunk)
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
      return directDbAccess()
        .transaction()
        .execute((tx) =>
          tx
            .insertInto('programExternalId')
            .values(multiChunk)
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
