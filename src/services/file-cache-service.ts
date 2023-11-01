import path from 'path';
import { createWriteStream, promises as fs } from 'fs';

/**
 * Store files in cache
 *
 * @class FileCacheService
 */
export class FileCacheService {
  private _cachePath: string;
  private cache: Record<string, string>;

  constructor(cachePath: string) {
    this._cachePath = cachePath;
    this.cache = {};
  }

  get cachePath(): string {
    return this._cachePath;
  }

  /**
   * `save` a file on cache folder
   */
  async setCache(fullFilePath: string, data: any): Promise<boolean> {
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

  /**
   * `get` a File from cache folder
   */
  async getCache(fullFilePath: string): Promise<string | undefined> {
    try {
      if (fullFilePath in this.cache) {
        return this.cache[fullFilePath];
      } else {
        return fs.readFile(path.join(this.cachePath, fullFilePath), 'utf8');
      }
    } catch (error) {
      return undefined;
    }
  }

  /**
   * `delete` a File from cache folder
   */
  async deleteCache(fullFilePath: string): Promise<boolean> {
    let thePath = path.join(this.cachePath, fullFilePath);
    try {
      await fs.open(thePath);
    } catch (err) {
      if (err == 'ENOENT') {
        return true;
      }
    }

    try {
      await fs.unlink(thePath);
      delete this.cache[fullFilePath];
      return true;
    } catch (err) {
      throw err;
    }
  }
}
