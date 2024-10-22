import { promises as fs } from 'fs';
import NodeCache from 'node-cache';
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

  private static cache = new NodeCache({
    stdTTL: 60 * 60,
  });

  constructor(
    public cachePath = path.join(serverOptions().databaseDirectory, 'cache'),
  ) {}

  /**
   * `save` a file on cache folder
   */
  async setCache(fullFilePath: string, data: string): Promise<boolean> {
    FileCacheService.cache.set(fullFilePath, data);
    await fs.writeFile(path.join(this.cachePath, fullFilePath), data);
    return true;
  }

  async exists(fullFilePath: string) {
    return (
      FileCacheService.cache.has(fullFilePath) ||
      (await fileExists(path.join(this.cachePath, fullFilePath)))
    );
  }

  /**
   * `get` a File from cache folder
   */
  async getCache(fullFilePath: string): Promise<string | undefined> {
    const fullPath = path.join(this.cachePath, fullFilePath);
    try {
      const memValue = FileCacheService.cache.get<string>(fullFilePath);
      if (memValue) {
        return memValue;
      } else if (await fileExists(fullPath)) {
        return await fs.readFile(fullPath, 'utf8');
      }
    } catch (error) {
      this.#logger.error(error);
      return;
    }
    return;
  }

  /**
   * `delete` a File from cache folder
   */
  async deleteCache(fullFilePath: string): Promise<boolean> {
    const thePath = path.join(this.cachePath, fullFilePath);

    if (!(await fileExists(thePath))) {
      return false;
    }

    await fs.unlink(thePath);
    FileCacheService.cache.del(fullFilePath);
    return true;
  }
}
