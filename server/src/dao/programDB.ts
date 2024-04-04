import { chunk, reduce } from 'lodash-es';
import { flatMapAsyncSeq, groupByFunc } from '../util';
import { programSourceTypeFromString } from './custom_types/ProgramSourceType';
import { getEm } from './dataSource';
import { Program } from './entities/Program';

export class ProgramDB {
  async lookupByExternalIds(
    ids: Set<[string, string, string]>,
    chunkSize: number = 25,
  ) {
    const em = getEm();
    const results = await flatMapAsyncSeq(
      chunk([...ids], chunkSize),
      async (idChunk) => {
        return await reduce(
          idChunk,
          (acc, [ps, es, ek]) => {
            return acc.orWhere({
              sourceType: programSourceTypeFromString(ps)!,
              externalSourceId: es,
              externalKey: ek,
            });
          },
          em
            .qb(Program)
            .select(['uuid', 'sourceType', 'externalSourceId', 'externalKey']),
        );
      },
    );
    return groupByFunc(
      results,
      (r) => r.uniqueId(),
      (r) => r.toDTO(),
    );
  }
}
