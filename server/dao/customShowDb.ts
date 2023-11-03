import { isUndefined, map } from 'lodash-es';
import { DeepReadonly, MarkOptional } from 'ts-essentials';
import { v4 as uuidv4 } from 'uuid';
import { Maybe } from '../types.js';
import { CustomShow, CustomShowCollection, DbAccess } from './db.js';

export type CustomShowUpdate = MarkOptional<CustomShow, 'content'>;
export type CustomShowInsert = MarkOptional<CustomShow, 'id' | 'content'>;
export class CustomShowDB {
  private collection: CustomShowCollection;

  constructor(db: DbAccess) {
    this.collection = db.customShows();
  }

  getShow(id: string): Maybe<DeepReadonly<CustomShow>> {
    return this.collection.getById(id);
  }

  async saveShow(id: Maybe<string>, customShow: CustomShowUpdate) {
    if (isUndefined(id)) {
      throw Error('Mising custom show id');
    }

    const showToSave: CustomShow = {
      ...customShow,
      content: customShow.content ?? [],
      id,
    };

    return this.collection.insertOrUpdate(showToSave);
  }

  async createShow(customShow: CustomShowInsert) {
    const id = uuidv4();
    await this.saveShow(id, {
      ...customShow,
      id,
      content: customShow.content ?? [],
    });
    return id;
  }

  async deleteShow(id: string) {
    return this.collection.delete(id);
  }

  getAllShowIds(): string[] {
    return map(this.getAllShows(), 'id');
  }

  getAllShows(): DeepReadonly<CustomShow[]> {
    return this.collection.getAll();
  }

  getAllShowsInfo() {
    //returns just name and id
    const shows = this.getAllShows();
    return shows.map((f) => {
      return {
        id: f.id,
        name: f.name,
        count: f.content.length,
      };
    });
  }
}
