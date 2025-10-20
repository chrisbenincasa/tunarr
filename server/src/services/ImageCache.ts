import { inject, injectable } from 'inversify';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path, { basename, dirname, extname } from 'node:path';
import { match } from 'ts-pattern';
import { ArtworkType } from '../db/schema/Artwork.ts';
import { GlobalOptions } from '../globals.ts';
import { KEYS } from '../types/inject.ts';
import { Result } from '../types/result.ts';
import {
  BannerCacheFolderName,
  CacheFolderName,
  FanartCacheFolderName,
  LandscapeCacheFolderName,
  LogoCacheFolderName,
  PosterCacheFolderName,
  ThumbnailCacheFolderName,
  WatermarkCacheFolderName,
} from '../util/constants.ts';
import { fileExists } from '../util/fsUtil.ts';
import { caughtErrorToError } from '../util/index.ts';

type ImageCacheResult = {
  fullPath: string;
  cacheKey: string;
};

@injectable()
export class ImageCache {
  constructor(@inject(KEYS.GlobalOptions) private globalOpts: GlobalOptions) {}

  async addArtworkToCache(
    filePath: string,
    artworkType: ArtworkType,
  ): Promise<Result<ImageCacheResult>> {
    try {
      const stat = await fs.stat(filePath);
      const originalExtension = extname(filePath);
      const hashed = crypto
        .createHash('md5')
        .update(`${filePath}_${stat.mtimeMs}`)
        .digest('hex');
      const hashedWithExt = `${hashed}${originalExtension === '' ? '' : originalExtension}`;
      const outPath = this.getImagePath(hashedWithExt, artworkType);
      if (!(await fileExists(dirname(outPath)))) {
        await fs.mkdir(dirname(outPath), { recursive: true });
      }

      await fs.copyFile(filePath, outPath);

      return Result.success({
        fullPath: outPath,
        cacheKey: hashedWithExt,
      });
    } catch (e) {
      return Result.forError(caughtErrorToError(e));
    }
  }

  /*
  TODO: We need to figure out a cross-platform solution to installing sharp
  async calculateBlurHash(
    cacheKey: string,
    artworkType: ArtworkType,
    xComponents: number,
    yComponents: number,
  ) {
    return Result.attemptAsync(async () => {
      const filePath = this.getImagePath(cacheKey, artworkType);
      const contents = await fs.readFile(filePath);
      const { data, info } = await timeNamedAsync(
        'read image file',
        this.logger,
        () =>
          sharp(contents)
            .raw()
            .ensureAlpha()
            .toBuffer({ resolveWithObject: true }),
      );
      const hash = timeNamedSync('calcualted blurhash', this.logger, () =>
        blurhash.encode(
          new Uint8ClampedArray(data),
          info.width,
          info.height,
          xComponents,
          yComponents,
        ),
      );
      return hash;
    });
  }
    */

  getImagePath(cacheKey: string, artworkType: ArtworkType) {
    const cacheKeyBaseName = basename(cacheKey);
    const base = match(artworkType)
      .with('banner', () => BannerCacheFolderName)
      .with('fanart', () => FanartCacheFolderName)
      .with('landscape', () => LandscapeCacheFolderName)
      .with('logo', () => LogoCacheFolderName)
      .with('poster', () => PosterCacheFolderName)
      .with('thumbnail', () => ThumbnailCacheFolderName)
      .with('watermark', () => WatermarkCacheFolderName)
      .exhaustive();
    return path.join(
      this.globalOpts.databaseDirectory,
      CacheFolderName,
      base,
      cacheKeyBaseName.slice(0, 2),
      cacheKeyBaseName.slice(cacheKeyBaseName.length - 2),
      cacheKey,
    );
  }
}
