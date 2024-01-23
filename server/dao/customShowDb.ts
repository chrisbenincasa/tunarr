import { isContentProgram } from 'dizquetv-types';
import { CreateCustomShowRequest } from 'dizquetv-types/api';
import { chain, isUndefined, map, partition, reduce } from 'lodash-es';
import { MarkOptional } from 'ts-essentials';
import { Maybe } from '../types.js';
import { ProgramMinterFactory } from '../util/programMinter.js';
import { getEm } from './dataSource.js';
import { CustomShow } from './entities/CustomShow.js';
import { CustomShowContent } from './entities/CustomShowContent.js';
import { Program } from './entities/Program.js';
import { dbProgramToContentProgram } from './converters/programConverters.js';

export type CustomShowUpdate = MarkOptional<CustomShow, 'content'>;
export type CustomShowInsert = {
  uuid?: string;
  name: string;
  content?: string[];
};

export class CustomShowDB {
  async getShow(id: string) {
    return getEm()
      .repo(CustomShow)
      .findOne({ uuid: id }, { populate: ['content.uuid'] });
  }

  async getShowPrograms(id: string) {
    const customShowContent = await getEm()
      .repo(CustomShowContent)
      .find(
        { customShow: id },
        { populate: ['content.*'], orderBy: { index: 'desc' } },
      );

    return customShowContent.map((csc) => {
      return dbProgramToContentProgram(csc.content, true);
    });
  }

  async saveShow(id: Maybe<string>, customShow: CustomShowUpdate) {
    if (isUndefined(id)) {
      throw Error('Mising custom show id');
    }

    return getEm().repo(CustomShow).upsert(customShow);
  }

  async createShow(createRequest: CreateCustomShowRequest) {
    const em = getEm();
    const show = em.repo(CustomShow).create({
      name: createRequest.name,
    });

    let idx = 0;
    const programIndexById = reduce(
      createRequest.programs,
      (acc, p) => {
        if (p.persisted) {
          acc[p.id!] = idx++;
        } else if (isContentProgram(p)) {
          acc[
            `${p.externalSourceType}_${p.externalSourceName!}_${p
              .originalProgram?.key}`
          ] = idx++;
        }
        return acc;
      },
      {} as Record<string, number>,
    );

    const [nonPersisted, persisted] = partition(
      createRequest.programs,
      (p) => !p.persisted,
    );
    const minter = ProgramMinterFactory.create(em);

    // TODO handle custom shows
    const programsToPersist = chain(nonPersisted)
      .filter(isContentProgram)
      .map((p) => minter.mint(p.externalSourceName!, p.originalProgram!))
      .value();

    const upsertedPrograms = await em.upsertMany(Program, programsToPersist, {
      batchSize: 10,
      onConflictAction: 'merge',
      onConflictFields: ['sourceType', 'externalSourceId', 'externalKey'],
      onConflictExcludeFields: ['uuid'],
    });

    await em.persist(show).flush();

    const persistedCustomShowContent = map(persisted, (p) =>
      em.create(CustomShowContent, {
        customShow: show.uuid,
        content: p.id!,
        index: programIndexById[p.id!],
      }),
    );
    const newCustomShowContent = map(upsertedPrograms, (p) =>
      em.create(CustomShowContent, {
        customShow: show.uuid,
        content: p.uuid,
        index: programIndexById[p.uniqueId()],
      }),
    );

    await em
      .persist([...persistedCustomShowContent, ...newCustomShowContent])
      .flush();

    return show.uuid;
  }

  async deleteShow(id: string) {
    const em = getEm();
    await em.removeAndFlush(em.getReference(CustomShow, id));
  }

  async getAllShowIds() {
    const res = await getEm()
      .repo(CustomShow)
      .findAll({ fields: ['uuid'] });
    return res.map((s) => s.uuid);
  }

  getAllShows() {
    return getEm().repo(CustomShow).findAll();
  }

  async getAllShowsInfo() {
    const shows = await getEm()
      .repo(CustomShow)
      .findAll({ populate: ['content.uuid'] });
    return shows.map((f) => {
      return {
        id: f.uuid,
        name: f.name,
        count: f.content.length,
      };
    });
  }
}
