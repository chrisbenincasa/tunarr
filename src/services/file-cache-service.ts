import path from 'path';
import { createWriteStream, promises as fs } from 'fs';

// // const open = promisify(fs.open);
// const unlink = promisify(fs.unlink);
// const readFile = promisify(fs.readFile);

/**
 * Store files in cache
 *
 * @class FileCacheService
 */
export class FileCacheService {
  cachePath: any;
  cache: {};

  constructor(cachePath) {
    this.cachePath = cachePath;
    this.cache = {};
  }

  /**
   * `save` a file on cache folder
   */
  async setCache(fullFilePath: string, data: any): Promise<any> {
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
  async getCache(fullFilePath: string): Promise<any> {
    try {
      if (fullFilePath in this.cache) {
        return this.cache[fullFilePath];
      } else {
        return fs.readFile(path.join(this.cachePath, fullFilePath), 'utf8');
      }
    } catch (error) {
      throw Error("Can't get file", error);
    }
  }

  /**
   * `delete` a File from cache folder
   */
  async deleteCache(fullFilePath: string): Promise<any> {
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
