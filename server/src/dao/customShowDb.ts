import { CustomProgram } from '@tunarr/types';
import { CreateCustomShowRequest } from '@tunarr/types/api';
import { filter, isUndefined, map } from 'lodash-es';
import { MarkOptional } from 'ts-essentials';
import { Maybe } from '../types.js';
import { mapAsyncSeq } from '../util/index.js';
import { ProgramConverter } from './converters/programConverters.js';
import { getEm } from './dataSource.js';
import { CustomShow } from './entities/CustomShow.js';
import { CustomShowContent } from './entities/CustomShowContent.js';
import {
  createPendingProgramIndexMap,
  upsertContentPrograms,
} from './programHelpers.js';

export type CustomShowUpdate = MarkOptional<CustomShow, 'content'>;
export type CustomShowInsert = {
  uuid?: string;
  name: string;
  content?: string[];
};

export class CustomShowDB {
  #programConverter: ProgramConverter = new ProgramConverter();

  async getShow(id: string) {
    return getEm()
      .repo(CustomShow)
      .findOne(
        { uuid: id },
        { populate: ['content.uuid', 'content.duration'] },
      );
  }

  async getShowPrograms(id: string): Promise<CustomProgram[]> {
    const customShowContent = await getEm()
      .repo(CustomShowContent)
      .find(
        { customShow: id },
        {
          // Preload relations
          populate: [
            'content',
            'content.album',
            'content.artist',
            'content.tvShow',
            'content.season',
          ],
          orderBy: { index: 'desc' },
        },
      );

    return mapAsyncSeq(customShowContent, async (csc) => ({
      type: 'custom',
      persisted: true,
      duration: csc.content.duration,
      program: await this.#programConverter.entityToContentProgram(csc.content),
      customShowId: id,
      index: csc.index,
      id: csc.content.uuid,
    }));
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

    const programIndexById = createPendingProgramIndexMap(
      createRequest.programs,
    );

    const persisted = filter(createRequest.programs, (p) => p.persisted);

    const upsertedPrograms = await upsertContentPrograms(
      createRequest.programs,
    );

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
    const show = await em.findOne(CustomShow, { uuid: id });
    if (!show) {
      return false;
    }

    await em.transactional(async (em) => {
      show.channels.removeAll();
      show.content.removeAll();
      await em.flush();
      await em.removeAndFlush(show);
    });

    return true;
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
