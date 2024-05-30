import { chunk, isNil, map } from 'lodash-es';
import {
  flatMapAsyncSeq,
  groupByAndMapAsync,
  isNonEmptyString,
} from '../util/index.js';
import { ProgramConverter } from './converters/programConverters.js';
import { programSourceTypeFromString } from './custom_types/ProgramSourceType';
import { getEm } from './dataSource';
import { Program } from './entities/Program';
import { ProgramExternalId } from './entities/ProgramExternalId.js';
import { ProgramExternalIdType } from './custom_types/ProgramExternalIdType.js';

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

  async getProgramExternalIds(programId: string) {
    const em = getEm();
    return await em.find(ProgramExternalId, {
      program: programId,
    });
  }

  async updateProgramPlexRatingKey(
    programId: string,
    plexServerName: string,
    details: Pick<
      ProgramExternalId,
      'externalKey' | 'directFilePath' | 'externalFilePath'
    >,
  ) {
    const em = getEm();
    const existingRatingKey = await em.findOne(ProgramExternalId, {
      program: programId,
      externalSourceId: plexServerName,
      sourceType: ProgramExternalIdType.PLEX,
    });

    if (isNil(existingRatingKey)) {
      const newEid = em.create(ProgramExternalId, {
        program: em.getReference(Program, programId),
        sourceType: ProgramExternalIdType.PLEX,
        externalSourceId: plexServerName,
        ...details,
      });
      em.persist(newEid);
    } else {
      existingRatingKey.externalKey = details.externalKey;
      if (isNonEmptyString(details.externalFilePath)) {
        existingRatingKey.externalFilePath = details.externalFilePath;
      }
      if (isNonEmptyString(details.directFilePath)) {
        existingRatingKey.directFilePath = details.directFilePath;
      }
    }
    await em.flush();
  }
}
