import { find, findIndex, isUndefined, map } from 'lodash-es';
import { MarkOptional } from 'ts-essentials';
import { v4 as uuidv4 } from 'uuid';
import { Maybe } from '../types.js';
import { CustomShow, DbAccess } from './db.js';

export class CustomShowDB {
  private db: DbAccess;

  constructor(db: DbAccess) {
    this.db = db;
  }

  async getShow(id: string): Promise<Maybe<CustomShow>> {
    return find(this.db.rawDb.data.customShows, { id });
  }

  async saveShow(
    id: Maybe<string>,
    customShow: MarkOptional<CustomShow, 'content'>,
  ) {
    if (isUndefined(id)) {
      throw Error('Mising custom show id');
    }

    const existingShowIdx = findIndex(this.db.rawDb.data.customShows, { id });
    if (isUndefined(customShow.content)) {
      customShow.content = [];
    }
    customShow.id = id;

    if (existingShowIdx === -1) {
      this.db.rawDb.data.customShows.push(customShow as Required<CustomShow>);
    } else {
      this.db.rawDb.data.customShows[existingShowIdx] =
        customShow as Required<CustomShow>;
    }

    return this.db.rawDb.write;
  }

  async createShow(customShow: MarkOptional<CustomShow, 'id' | 'content'>) {
    let id = uuidv4();
    await this.saveShow(id, {
      ...customShow,
      id,
      content: customShow.content ?? [],
    });
    return id;
  }

  async deleteShow(id: string) {
    const idx = findIndex(this.db.rawDb.data.customShows, { id });
    if (idx === -1) {
      return false;
    }

    this.db.rawDb.data.customShows = this.db.rawDb.data.customShows.splice(
      idx,
      1,
    );
    return this.db.rawDb.write().then(() => true);
  }

  async getAllShowIds(): Promise<string[]> {
    return map(this.db.rawDb.data.customShows, 'id');
  }

  async getAllShows() {
    const ids = await this.getAllShowIds();
    return (await Promise.all(ids.map(this.getShow))).map((x) => x!);
  }

  async getAllShowsInfo() {
    //returns just name and id
    let shows = await this.getAllShows();
    return shows.map((f) => {
      return {
        id: f.id,
        name: f.name,
        count: f.content.length,
      };
    });
  }
}
