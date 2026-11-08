import type { CachedImage } from '@/db/schema/CachedImage.js';
import { InjectLogger } from '@/util/inject.js';
import type { Logger } from '@/util/logging/LoggerFactory.js';
import { outboundRequestGuard } from '@/util/outboundRequests.js';
import type { AxiosHeaders } from 'axios';
import axios from 'axios';
import type { FastifyReply } from 'fastify';
import { inject, injectable } from 'inversify';
import type { Kysely } from 'kysely';
import { isString, isUndefined } from 'lodash-es';
import crypto from 'node:crypto';
import { createWriteStream, promises as fs } from 'node:fs';
import { Transform, type Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { DB } from '../db/schema/db.ts';
import { KEYS } from '../types/inject.ts';
import { FileCacheService } from './FileCacheService.ts';

const MaxImageBytes = 10 * 1024 * 1024;
const ImageRequestTimeoutMs = 30_000;

/**
 * Downloads an image to a file and returns its content type.
 *
 * API callers supply these URLs without authentication, so the request goes
 * through outboundRequestGuard and the body is capped at maxBytes. axios does
 * not enforce maxContentLength on stream responses, so the cap is counted here.
 * A failed download removes the partial file so the cache never serves it.
 */
export async function downloadImageToFile(
  url: string,
  path: string,
  maxBytes: number = MaxImageBytes,
): Promise<string | undefined> {
  const response = await axios.request<Readable>({
    method: 'get',
    url,
    responseType: 'stream',
    timeout: ImageRequestTimeoutMs,
    ...outboundRequestGuard,
  });

  let received = 0;
  const limit = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      received += chunk.length;
      if (received > maxBytes) {
        callback(new Error(`Image exceeds the ${maxBytes} byte limit`));
        return;
      }
      callback(null, chunk);
    },
  });

  try {
    await pipeline(response.data, limit, createWriteStream(path));
  } catch (e) {
    await fs.rm(path, { force: true });
    throw e;
  }

  const mimeType = (response.headers as AxiosHeaders).get('content-type');
  return isString(mimeType) ? mimeType : undefined;
}

/**
 * Manager a cache in disk for external images.
 *
 * @class CacheImageService
 */
@injectable()
export class CacheImageService {
  private cacheService!: FileCacheService;
  private imageCacheFolder: string;

  @InjectLogger() declare private readonly logger: Logger;

  constructor(@inject(KEYS.Database) private db: Kysely<DB>) {
    this.cacheService = new FileCacheService();
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
  async routerInterceptor(hash: string, res: FastifyReply) {
    try {
      const imgItem = await this.db
        .selectFrom('cachedImage')
        .where('hash', '=', hash)
        .selectAll()
        .executeTakeFirst();

      if (imgItem) {
        const file = await this.getImageFromCache(imgItem.hash);
        if (isUndefined(file) || !file.length) {
          const fileMimeType = await this.requestImageAndStore(imgItem);
          void res.header('content-type', fileMimeType);
        } else {
          void res.header('content-type', imgItem.mimeType);
        }
      }
    } catch (err) {
      this.logger.error(err);
      return res.status(500).send('error');
    }
  }

  async getOrDownloadImageUrl(url: string) {
    return this.getOrDownloadImage(await this.registerImageOnDatabase(url));
  }

  async getOrDownloadImage(hash: string) {
    const imgItem = await this.db
      .selectFrom('cachedImage')
      .where('hash', '=', hash)
      .selectAll()
      .executeTakeFirst();

    if (imgItem) {
      if (
        !(await this.cacheService.exists(
          `${this.imageCacheFolder}/${imgItem.hash}`,
        ))
      ) {
        return await this.requestImageAndStore(imgItem);
      } else {
        return {
          path: this.getCacheFilePath(imgItem),
          mimeType: imgItem.mimeType,
        };
      }
    }

    return;
  }

  private async requestImageAndStore(
    cachedImage: CachedImage,
  ): Promise<{ path: string; mimeType?: string }> {
    this.logger.debug('Requesting original image file for caching');

    const path = this.getCacheFilePath(cachedImage);
    const mimeType = await downloadImageToFile(cachedImage.url, path);

    if (mimeType) {
      this.logger.debug('Got image file with mimeType %s', mimeType);
      await this.db
        .insertInto('cachedImage')
        .values({
          ...cachedImage,
          mimeType,
        })
        .onConflict((oc) =>
          oc.column('hash').doUpdateSet({ ...cachedImage, mimeType }),
        )
        .executeTakeFirst();
    }

    return { path, mimeType };
  }

  /**
   * Get image from cache using an filename
   */
  async getImageFromCache(fileName: string): Promise<string | undefined> {
    try {
      return await this.cacheService.getCache(
        `${this.imageCacheFolder}/${fileName}`,
      );
    } catch (e) {
      this.logger.debug(e, `Image ${fileName} not found in cache.`);
      return;
    }
  }

  /**
   * Clear all files on {databasePath}/cache/images
   */
  async clearCache() {
    const cachePath = `${this.cacheService.cachePath}/${this.imageCacheFolder}`;
    await fs.rm(cachePath, { recursive: true, force: true });
    await fs.mkdir(cachePath);
  }

  async registerImageOnDatabase(imageUrl: string) {
    const encodedUrl = crypto
      .createHash('md5')
      .update(imageUrl)
      .digest('base64url');

    await this.db
      .insertInto('cachedImage')
      .values({
        hash: encodedUrl,
        url: imageUrl,
      })
      .onConflict((oc) => oc.column('hash').doUpdateSet({ url: imageUrl }))
      .executeTakeFirst();

    return encodedUrl;
  }

  private getCacheFilePath(cachedImage: CachedImage) {
    return `${this.cacheService.cachePath}/${this.imageCacheFolder}/${cachedImage.hash}`;
  }
}
