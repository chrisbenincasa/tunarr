import {
  chunk,
  flatten,
  groupBy,
  isNil,
  keys,
  map,
  mapValues,
  union,
  uniq,
} from 'lodash-es';
import {
  groupByAndMapAsync,
  groupByUniq,
  groupByUniqFunc,
  isNonEmptyString,
  mapReduceAsyncSeq,
} from '../util/index.js';
import { ProgramConverter } from './converters/programConverters.js';
import { getEm } from './dataSource';
import { Program } from './entities/Program';
import { ProgramExternalId } from './entities/ProgramExternalId.js';
import {
  ProgramExternalIdType,
  programExternalIdTypeFromString,
} from './custom_types/ProgramExternalIdType.js';
import { asyncPool, unfurlPool } from '../util/asyncPool.js';
import { Loaded } from '@mikro-orm/better-sqlite';

export class ProgramDB {
  async getProgramById(id: string) {
    return getEm().findOne(Program, id, { populate: ['externalIds'] });
  }

  async getProgramsByIds(ids: string[], batchSize: number = 50) {
    const em = getEm();
    return mapReduceAsyncSeq(
      chunk(uniq(ids), batchSize),
      (ids) =>
        em.find(Program, { uuid: { $in: ids } }, { populate: ['externalIds'] }),
      (acc, curr) => [...acc, ...curr],
      [] as Loaded<Program, 'externalIds', '*', never>[],
    );
  }

  async lookupByExternalIds(
    ids: Set<[string, string, string]>,
    chunkSize: number = 25,
  ) {
    const em = getEm();
    const converter = new ProgramConverter();

    const tasks = asyncPool(
      chunk([...ids], chunkSize),
      async (idChunk) => {
        return await em.find(ProgramExternalId, {
          $or: map(idChunk, ([ps, es, ek]) => ({
            sourceType: programExternalIdTypeFromString(ps)!,
            externalSourceId: es,
            externalKey: ek,
          })),
        });
      },
      { concurrency: 2 },
    );

    const externalIdsdByProgram = groupBy(
      flatten(await unfurlPool(tasks)),
      (x) => x.program.uuid,
    );

    const programs = await mapReduceAsyncSeq(
      chunk(keys(externalIdsdByProgram), 50),
      async (programIdChunk) => await em.find(Program, programIdChunk),
      (acc, curr) => ({ ...acc, ...groupByUniq(curr, 'uuid') }),
      {} as Record<string, Loaded<Program>>,
    );

    return groupByAndMapAsync(
      // Silently drop programs we can't find.
      union(keys(externalIdsdByProgram), keys(programs)),
      (programId) => programId,
      (programId) => {
        const eids = externalIdsdByProgram[programId];
        return converter.entityToContentProgram(programs[programId], eids, {
          skipPopulate: { externalIds: false },
        });
      },
    );
  }

  async programIdsByExternalIds(
    ids: Set<[string, string, string]>,
    chunkSize: number = 50,
  ) {
    const em = getEm();
    const tasks = asyncPool(
      chunk([...ids], chunkSize),
      async (idChunk) => {
        return await em.find(ProgramExternalId, {
          $or: map(idChunk, ([ps, es, ek]) => ({
            sourceType: programExternalIdTypeFromString(ps)!,
            externalSourceId: es,
            externalKey: ek,
          })),
        });
      },
      { concurrency: 2 },
    );

    return mapValues(
      groupByUniqFunc(flatten(await unfurlPool(tasks)), (eid) =>
        eid.toExternalIdString(),
      ),
      (eid) => eid.program.uuid,
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
