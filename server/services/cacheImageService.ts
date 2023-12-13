import axios, { AxiosHeaders, AxiosRequestConfig } from 'axios';
import crypto from 'crypto';
import { FastifyPluginCallback, FastifyReply, FastifyRequest } from 'fastify';
import { createWriteStream, promises as fs } from 'fs';
import { isString, isUndefined } from 'lodash-es';
import stream from 'stream';
// import { CachedImage, DbAccess } from '../dao/db.js';
import createLogger from '../logger.js';
import { FileCacheService } from './fileCacheService.js';
import { CachedImage } from '../dao/entities/CachedImage.js';
import { EntityRepository } from '@mikro-orm/core';
import { withDb } from '../dao/dataSource.js';

const logger = createLogger(import.meta);

/**
 * Manager a cache in disk for external images.
 *
 * @class CacheImageService
 */
export class CacheImageService {
  private cacheService: FileCacheService;
  private imageCacheFolder: string;

  constructor(fileCacheService: FileCacheService) {
    this.cacheService = fileCacheService;
    this.imageCacheFolder = 'images';
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
  async routerInterceptor(
    req: FastifyRequest<{ Params: { hash: string } }>,
    res: FastifyReply,
  ) {
    try {
      const hash = req.params.hash;
      const repo = req.entityManager.repo(CachedImage);
      const imgItem = await repo.findOne({ hash });
      if (imgItem) {
        const file = await this.getImageFromCache(imgItem.hash);
        if (isUndefined(file) || !file.length) {
          const fileMimeType = await this.requestImageAndStore(imgItem, repo);
          void res.header('content-type', fileMimeType);
        } else {
          void res.header('content-type', imgItem.mimeType);
        }
      }
    } catch (err) {
      return res.status(500).send('error');
    } finally {
      await req.entityManager.flush();
    }
  }

  /**
   * Routers exported to use on express.use() function.
   * Use on api routers, like `{host}/api/cache/images`
   *
   * `DELETE /` - Clear all files on .dizquetv/cache/images
   */
  apiRouters(): FastifyPluginCallback {
    return (fastify, _, done) => {
      fastify.delete('/', async (_req, res) => {
        try {
          await this.clearCache();
          return res.status(200).send({ msg: 'Cache Image are Cleared' });
        } catch (error) {
          logger.error('Error deleting cached images', error);
          return res.status(500).send('error');
        }
      });

      done();
    };
  }

  private async requestImageAndStore(
    cachedImage: CachedImage,
    repo: EntityRepository<CachedImage>,
  ): Promise<string | undefined> {
    const requestConfiguration: AxiosRequestConfig = {
      method: 'get',
      url: cachedImage.url,
      responseType: 'stream',
    };

    logger.debug('Requesting original image file for caching');

    const response = await axios.request<stream.Readable>(requestConfiguration);

    const mimeType = (response.headers as AxiosHeaders).get('content-type');
    if (!isUndefined(mimeType) && isString(mimeType)) {
      logger.debug('Got image file with mimeType ' + mimeType);
      await repo.upsert({ ...cachedImage, mimeType });
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
      return this.cacheService
        .getCache(`${this.imageCacheFolder}/${fileName}`)
        .catch(() => void 0);
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
    const encodedUrl = crypto
      .createHash('md5')
      .update(imageUrl)
      .digest('base64');
    // const encodedUrl = Buffer.from(imageUrl).toString('base64');
    await withDb(async (em) => {
      await em.repo(CachedImage).upsert({ hash: encodedUrl, url: imageUrl });
      await em.flush();
    });
    return encodedUrl;
  }
}
