import axios, { AxiosRequestConfig } from 'axios';
import express from 'express';
import { createWriteStream, promises as fs } from 'fs';
import { isString, isUndefined } from 'lodash-es';
import stream from 'stream';
import { CachedImage, DbAccess } from '../dao/db.js';
import createLogger from '../logger.js';
import { FileCacheService } from './file-cache-service.js';

const logger = createLogger(import.meta);

/**
 * Manager a cache in disk for external images.
 *
 * @class CacheImageService
 */
export class CacheImageService {
  private cacheService: FileCacheService;
  private imageCacheFolder: string;
  private dbAccess: DbAccess;

  constructor(dbAccess: DbAccess, fileCacheService: FileCacheService) {
    this.cacheService = fileCacheService;
    this.imageCacheFolder = 'images';
    this.dbAccess = dbAccess;
  }

  /**
   * Router interceptor to download image and update cache before pass to express.static return this cached image.
   *
   * GET /:hash - Hash is a full external URL encoded in base64.
   * eg.: http://{host}/cache/images/aHR0cHM6Ly8xO...cXVUbmFVNDZQWS1LWQ==
   *
   * @returns
   * @memberof CacheImageService
   */
  routerInterceptor(): express.Router {
    const router = express.Router();

    router.get('/:hash', async (req, res, next) => {
      try {
        const hash = req.params.hash;
        const imgItem = this.dbAccess.cachedImages().getById(hash);
        if (imgItem) {
          const file = await this.getImageFromCache(imgItem.hash);
          if (isUndefined(file) || !file.length) {
            const fileMimeType = await this.requestImageAndStore(imgItem);
            res.set('content-type', fileMimeType);
            next();
          } else {
            res.set('content-type', imgItem.mimeType);
            next();
          }
        }
      } catch (err) {
        console.error(err);
        res.status(500).send('error');
      }
    });
    return router;
  }

  /**
   * Routers exported to use on express.use() function.
   * Use on api routers, like `{host}/api/cache/images`
   *
   * `DELETE /` - Clear all files on .dizquetv/cache/images
   */
  apiRouters(): express.Router {
    const router = express.Router();

    router.delete('/', async (_req, res) => {
      try {
        await this.clearCache();
        res.status(200).send({ msg: 'Cache Image are Cleared' });
      } catch (error) {
        logger.error('Error deleting cached images', error);
        res.status(500).send('error');
      }
    });

    return router;
  }

  async requestImageAndStore(
    cachedImage: CachedImage,
  ): Promise<string | undefined> {
    const requestConfiguration: AxiosRequestConfig = {
      method: 'get',
      url: cachedImage.url,
      responseType: 'stream',
    };

    logger.debug('Requesting original image file for caching');

    const response = await axios.request<stream.Readable>(requestConfiguration);
    const mimeType = response.headers['Content-Type'];
    if (!isUndefined(mimeType) && isString(mimeType)) {
      logger.debug('Got image file with mimeType ' + mimeType);
      await this.dbAccess
        .cachedImages()
        .insertOrUpdate({ ...cachedImage, mimeType });
    }

    return new Promise((resolve, reject) => {
      response.data
        .pipe(
          createWriteStream(
            `${this.cacheService.cachePath}/${this.imageCacheFolder}/${cachedImage.hash}`,
          ),
        )
        .on('close', () => resolve(mimeType as string))
        .on('error', reject);
    });
  }

  /**
   * Get image from cache using an filename
   */
  getImageFromCache(fileName: string): Promise<string | undefined> {
    try {
      return this.cacheService.getCache(`${this.imageCacheFolder}/${fileName}`);
    } catch (e) {
      logger.debug(`Image ${fileName} not found in cache.`);
      return Promise.resolve(undefined);
    }
  }

  /**
   * Clear all files on .dizquetv/cache/images
   */
  async clearCache() {
    const cachePath = `${this.cacheService.cachePath}/${this.imageCacheFolder}`;
    await fs.rmdir(cachePath, { recursive: true });
    await fs.mkdir(cachePath);
  }

  async registerImageOnDatabase(imageUrl: string) {
    const encodedUrl = Buffer.from(imageUrl).toString('base64');
    await this.dbAccess
      .cachedImages()
      .insertOrUpdate({ hash: encodedUrl, url: imageUrl });
    return encodedUrl;
  }
}
