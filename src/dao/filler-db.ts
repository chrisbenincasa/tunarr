import fs from 'fs';
import { find, isUndefined, map } from 'lodash-es';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ChannelCache } from '../channel-cache.js';
import { ChannelDB } from './channel-db.js';
import {
  Channel,
  DbAccess,
  FillerCollection,
  FillerList,
  FillerProgram,
  Program,
} from './db.js';
import { Maybe } from '../types.js';
import createLogger from '../logger.js';

const logger = createLogger(import.meta);
export class FillerDB {
  private folder: string;
  private cache: Record<string, Maybe<FillerList>>;
  private channelDB: ChannelDB;
  private channelCache: ChannelCache;
  private dbAccess: DbAccess;

  constructor(
    folder,
    channelDB: ChannelDB,
    channelCache: ChannelCache,
    dbAccess: DbAccess,
  ) {
    this.folder = folder;
    this.cache = {};
    this.channelDB = channelDB;
    this.channelCache = channelCache;
    this.dbAccess = dbAccess;
  }

  private async getFillerInternal(id: string): Promise<Maybe<FillerList>> {
    return find(this.dbAccess.rawDb.data.fillerLists, { id });
  }

  // TODO Is cache necessary if we always have the DB in memory?
  async getFiller(id: string) {
    if (isUndefined(this.cache[id])) {
      this.cache[id] = await this.getFillerInternal(id);
    }
    return this.cache[id];
  }

  async saveFiller(id: string, json) {
    if (isUndefined(id)) {
      throw Error('Mising filler id');
    }
    let f = path.join(this.folder, `${id}.json`);
    try {
      await new Promise((resolve, reject) => {
        let data: any = undefined;
        try {
          //id is determined by the file name, not the contents
          fixup(json);
          delete json.id;
          data = JSON.stringify(json);
        } catch (err) {
          return reject(err);
        }
        fs.writeFile(f, data, (err) => {
          if (err) {
            return reject(err);
          }
          resolve(void 0);
        });
      });
    } finally {
      delete this.cache[id];
    }
  }

  async createFiller(json) {
    let id = uuidv4();
    fixup(json);
    await this.saveFiller(id, json);
    return id;
  }

  async getFillerChannels(id: string) {
    let numbers = await this.channelDB.getAllChannelNumbers();
    let channels: any = [];
    await Promise.all(
      numbers.map(async (number) => {
        let ch = await this.channelDB.getChannel(number);
        let name = ch!.name;
        let fillerCollections = ch!.fillerCollections ?? [];
        for (let i = 0; i < fillerCollections.length; i++) {
          if (fillerCollections[i].id === id) {
            channels.push({
              number: number,
              name: name,
            });
            break;
          }
        }
        // ch = null;
      }),
    );
    return channels;
  }

  async deleteFiller(id: string) {
    try {
      let channels = await this.getFillerChannels(id);
      await Promise.all(
        channels.map(async (channel) => {
          console.log(
            `Updating channel ${channel.number} , remove filler: ${id}`,
          );
          let json = await this.channelDB.getChannel(channel.number);
          if (json?.fillerCollections) {
            json.fillerCollections = json?.fillerCollections?.filter((col) => {
              return col.id != id;
            });
          }
          if (json) {
            await this.channelDB.saveChannel(json);
          }
        }),
      );
      this.channelCache.clear();
      let f = path.join(this.folder, `${id}.json`);
      await new Promise((resolve, reject) => {
        fs.unlink(f, function (err) {
          if (err) {
            return reject(err);
          }
          resolve(void 0);
        });
      });
    } finally {
      delete this.cache[id];
    }
  }

  async getAllFillerIds(): Promise<string[]> {
    return map(this.dbAccess.rawDb.data.fillerLists, 'id');
  }

  async getAllFillers() {
    let ids = await this.getAllFillerIds();
    return (await Promise.all(ids.map(this.getFiller))).map((x) => x!);
  }

  async getAllFillersInfo() {
    //returns just name and id
    let fillers = await this.getAllFillers();
    return fillers.map((f) => {
      return {
        id: f.id,
        name: f.name,
        count: f.content.length,
      };
    });
  }

  async getFillersFromChannel(
    channel: Channel,
  ): Promise<(FillerCollection & { content: Program[] })[]> {
    // TODO nasty return type, fix.
    let loadChannelFiller = async (fillerEntry: FillerCollection) => {
      let content: FillerProgram[] = [];
      try {
        let filler = await this.getFiller(fillerEntry.id);
        content = filler?.content ?? [];
      } catch (e) {
        logger.error(
          `Channel #${channel.number} - ${channel.name} references an unattainable filler id: ${fillerEntry.id}`,
          e,
        );
      }
      return {
        id: fillerEntry.id,
        content: content,
        weight: fillerEntry.weight,
        cooldownSeconds: fillerEntry.cooldownSeconds,
      };
    };
    return await Promise.all(
      (channel.fillerCollections ?? []).map(loadChannelFiller),
    );
  }
}

function fixup(json) {
  if (isUndefined(json.content)) {
    json.content = [];
  }
  if (isUndefined(json.name)) {
    json.name = 'Unnamed Filler';
  }
}
