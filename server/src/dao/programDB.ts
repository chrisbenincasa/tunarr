import { chunk, flatten, groupBy, isNil, keys, map } from 'lodash-es';
import { groupByAndMapAsync, isNonEmptyString } from '../util/index.js';
import { ProgramConverter } from './converters/programConverters.js';
import { getEm } from './dataSource';
import { Program } from './entities/Program';
import { ProgramExternalId } from './entities/ProgramExternalId.js';
import {
  ProgramExternalIdType,
  programExternalIdTypeFromString,
} from './custom_types/ProgramExternalIdType.js';
import { asyncPool, unfurlPool } from '../util/asyncPool.js';

export class ProgramDB {
  async lookupByExternalIds(
    ids: Set<[string, string, string]>,
    chunkSize: number = 25,
  ) {
    const em = getEm();
    const converter = new ProgramConverter();

    const tasks = asyncPool(
      chunk([...ids], chunkSize),
      async (idChunk) => {
        return await em.find(
          ProgramExternalId,
          {
            $or: map(idChunk, ([ps, es, ek]) => ({
              sourceType: programExternalIdTypeFromString(ps)!,
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
              'program.uuid',
              'program.duration',
              'program.title',
              'program.type',
              'program.artist.uuid',
              'program.artist.title',
              'program.album.title',
              'program.album.uuid',
            ],
            // fields: ['sourceType', 'externalKey', 'externalSourceId'],
          },
        );
      },
      { concurrency: 2 },
    );

    // const results = await flatMapAsyncSeq(
    //   chunk([...ids], chunkSize),
    //   async (idChunk) => {
    //     return em.find(
    //       Program,
    //       {
    //         $or: map(idChunk, ([ps, es, ek]) => ({
    //           sourceType: programSourceTypeFromString(ps)!,
    //           externalSourceId: es,
    //           $or: [
    //             {
    //               externalKey: ek,
    //             },
    //             {
    //               plexRatingKey: ek,
    //             },
    //           ],
    //         })),
    //       },
    //       {
    //         populate: [
    //           'artist.uuid',
    //           'artist.title',
    //           'album.title',
    //           'album.uuid',
    //           'tvShow.uuid',
    //           'tvShow.title',
    //           'season.uuid',
    //           'season.title',
    //         ],
    //         fields: [
    //           'uuid',
    //           'sourceType',
    //           'externalSourceId',
    //           'externalKey',
    //           'duration',
    //           'title',
    //           'type',
    //         ],
    //       },
    //     );
    //   },
    // );

    const externalIdsdByProgram = groupBy(
      flatten(await unfurlPool(tasks)),
      (x) => x.program.uuid,
    );

    return groupByAndMapAsync(
      keys(externalIdsdByProgram),
      (programId) => programId,
      (programId) => {
        const eids = externalIdsdByProgram[programId];
        return converter.entityToContentProgram(eids[0].program, eids, {
          skipPopulate: true,
        });
      },
    );

    // return await mapAsyncSeq(keys(externalIdsdByProgram), (programId) => {
    //   const eids = externalIdsdByProgram[programId];
    //   return converter.entityToContentProgram(eids[0].program, eids, {
    //     skipPopulate: true,
    //   });
    // });
    // return groupByAndMapAsync(
    //   ,
    //   (r) => r.uniqueId(),
    //   (r) => converter.partialEntityToContentProgram(r, { skipPopulate: true }),
    // );
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
