import { isUndefined } from 'lodash-es';
import { MarkOptional } from 'ts-essentials';
import { v4 as uuidv4 } from 'uuid';
import { Maybe } from '../types.js';
import { getEm } from './dataSource.js';
import { CustomShow } from './entities/CustomShow.js';
import { Program } from './entities/Program.js';

export type CustomShowUpdate = MarkOptional<CustomShow, 'content'>;
export type CustomShowInsert = {
  uuid?: string;
  name: string;
  content?: string[];
};

export class CustomShowDB {
  getShow(id: string) {
    return getEm().repo(CustomShow).findOne(id);
  }

  async saveShow(id: Maybe<string>, customShow: CustomShowUpdate) {
    if (isUndefined(id)) {
      throw Error('Mising custom show id');
    }

    return getEm().repo(CustomShow).upsert(customShow);
  }

  async createShow(customShow: CustomShowInsert) {
    const id = customShow.uuid ?? uuidv4();
    const em = getEm();
    const content = (customShow.content ?? []).map((id) =>
      em.getReference(Program, id),
    );
    const show = em.create(CustomShow, {
      uuid: id,
      name: customShow.name,
      content,
    });
    await em.insert(show);
    return id;
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
