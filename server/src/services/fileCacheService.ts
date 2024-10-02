import { createWriteStream, promises as fs } from 'fs';
import path from 'path';
import { serverOptions } from '../globals';
import { fileExists } from '../util/fsUtil.js';
import { LoggerFactory } from '../util/logging/LoggerFactory.js';

/**
 * Store files in cache
 *
 * @class FileCacheService
 */
export class FileCacheService {
  #logger = LoggerFactory.child({ className: this.constructor.name });
  private _cachePath: string;
  private cache: Record<string, string>;

  constructor(
    cachePath: string = path.join(serverOptions().databaseDirectory, 'cache'),
  ) {
    this._cachePath = cachePath;
    this.cache = {};
  }

  get cachePath(): string {
    return this._cachePath;
  }

  /**
   * `save` a file on cache folder
   */
  async setCache(fullFilePath: string, data: string): Promise<boolean> {
    const file = createWriteStream(path.join(this.cachePath, fullFilePath));

    return new Promise((resolve, reject) => {
      file.write(data, (err) => {
        if (err) {
          reject(Error("Can't save file: ", err));
        } else {
          this.cache[fullFilePath] = data;
          resolve(true);
        }
      });
    });
  }

  async exists(fullFilePath: string) {
    return (
      fullFilePath in this.cache ||
      (await fileExists(path.join(this.cachePath, fullFilePath)))
    );
  }

  /**
   * `get` a File from cache folder
   */
  async getCache(fullFilePath: string): Promise<string | undefined> {
    try {
      if (fullFilePath in this.cache) {
        return this.cache[fullFilePath];
      } else {
        return await fs.readFile(
          path.join(this.cachePath, fullFilePath),
          'utf8',
        );
      }
    } catch (error) {
      this.#logger.error(error);
      return;
    }
  }

  /**
   * `delete` a File from cache folder
   */
  async deleteCache(fullFilePath: string): Promise<boolean> {
    const thePath = path.join(this.cachePath, fullFilePath);
    try {
      await fs.open(thePath);
    } catch (err) {
      if (err == 'ENOENT') {
        return true;
      }
    }

    await fs.unlink(thePath);
    delete this.cache[fullFilePath];
    return true;
  }
}
