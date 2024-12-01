import { serverOptions } from '@/globals.ts';
import { fileExists } from '@/util/fsUtil.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { promises as fs } from 'fs';
import NodeCache from 'node-cache';
import path from 'path';

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
    private enableInMemoryCache: boolean = true,
  ) {}

  /**
   * `save` a file on cache folder
   */
  async setCache(fullFilePath: string, data: string): Promise<boolean> {
    if (this.enableInMemoryCache) {
      FileCacheService.cache.set(fullFilePath, data);
    }
    await fs.writeFile(path.join(this.cachePath, fullFilePath), data);
    return true;
  }

  async exists(fullFilePath: string) {
    return (
      (this.enableInMemoryCache && FileCacheService.cache.has(fullFilePath)) ||
      (await fileExists(path.join(this.cachePath, fullFilePath)))
    );
  }

  /**
   * `get` a File from cache folder
   */
  async getCache(fullFilePath: string): Promise<string | undefined> {
    const fullPath = path.join(this.cachePath, fullFilePath);
    try {
      const memValue = this.enableInMemoryCache
        ? FileCacheService.cache.get<string>(fullFilePath)
        : undefined;
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
    if (this.enableInMemoryCache) {
      FileCacheService.cache.del(fullFilePath);
    }
    return true;
  }
}
