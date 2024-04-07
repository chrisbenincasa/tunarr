import { chunk, map } from 'lodash-es';
import { flatMapAsyncSeq, groupByAndMapAsync } from '../util';
import { ProgramConverter } from './converters/programConverters.js';
import { programSourceTypeFromString } from './custom_types/ProgramSourceType';
import { getEm } from './dataSource';
import { Program } from './entities/Program';

export class ProgramDB {
  async lookupByExternalIds(
    ids: Set<[string, string, string]>,
    chunkSize: number = 25,
  ) {
    const em = getEm();
    const converter = new ProgramConverter();
    const results = await flatMapAsyncSeq(
      chunk([...ids], chunkSize),
      async (idChunk) => {
        return em.find(
          Program,
          {
            $or: map(idChunk, ([ps, es, ek]) => ({
              sourceType: programSourceTypeFromString(ps)!,
              externalSourceId: es,
              $or: [
                {
                  externalKey: ek,
                },
                {
                  plexRatingKey: ek,
                },
              ],
            })),
          },
          {
            populate: [
              'artist.uuid',
              'artist.title',
              'album.title',
              'album.uuid',
              'tvShow.uuid',
              'tvShow.title',
              'season.uuid',
              'season.title',
            ],
            fields: [
              'uuid',
              'sourceType',
              'externalSourceId',
              'externalKey',
              'duration',
              'title',
              'type',
            ],
          },
        );
      },
    );
    return groupByAndMapAsync(
      results,
      (r) => r.uniqueId(),
      (r) => converter.partialEntityToContentProgram(r, { skipPopulate: true }),
    );
  }
}
