import { inject, injectable } from 'inversify';
import fs from 'node:fs/promises';
import path from 'path';
import { MediaSourceId, MediaSourceType } from '../db/schema/base.ts';
import { QueryResult } from '../external/BaseApiClient.ts';
import { FileSystemService } from '../services/FileSystemService.ts';
import { KEYS } from '../types/inject.ts';
import { Maybe } from '../types/util.ts';
import { fileExists } from '../util/fsUtil.ts';
import { Logger } from '../util/logging/LoggerFactory.ts';
import {
  getSubtitleCacheFilePath,
  subtitleCodecToExt,
} from '../util/subtitles.ts';

export type GetSubtitleCallbackArgs = {
  extension: string;
};

type GetSubtitlesCallback = (
  cbArgs: GetSubtitleCallbackArgs,
) => Promise<QueryResult<string>>;

type ExternalItem = {
  externalKey: string;
  externalSourceId: MediaSourceId;
  sourceType: MediaSourceType;
  uuid: string;
};

@injectable()
export class ExternalSubtitleDownloader {
  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(FileSystemService) private fileSystemService: FileSystemService,
  ) {}

  /**
   * Given an item and an external subtitle stream belonging to that item, potentially download the external stream from
   * the source
   * @param item
   * @param details
   * @param getSubtitlesCb
   * @returns The full path to the downloaded subtitles
   */
  async downloadSubtitlesIfNecessary(
    item: ExternalItem,
    details: { streamIndex: Maybe<number>; codec: string },
    getSubtitlesCb: GetSubtitlesCallback,
  ) {
    const outPath = getSubtitleCacheFilePath(
      {
        externalKey: item.externalKey,
        externalSourceId: item.externalSourceId,
        externalSourceType: item.sourceType,
        id: item.uuid,
      },
      {
        codec: details.codec,
        streamIndex: details.streamIndex,
      },
    );
    const ext = subtitleCodecToExt(details.codec);

    if (!outPath || !ext) {
      return;
    }

    // This should've been created on startup but double-check
    const cacheFolder = this.fileSystemService.getSubtitleCacheFolder();
    if (!(await fileExists(cacheFolder))) {
      await fs.mkdir(cacheFolder);
    }

    const fullPath = path.join(cacheFolder, outPath);

    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    if (!(await fileExists(fullPath))) {
      const subtitlesRes = await getSubtitlesCb({ extension: ext });

      if (subtitlesRes.isFailure()) {
        this.logger.warn(
          subtitlesRes.error,
          'Error while requesting external subtitle stream: %s',
          subtitlesRes.error.message ?? '',
        );
        return;
      }

      try {
        await fs.writeFile(fullPath, subtitlesRes.get());
        return fullPath;
      } catch (e) {
        this.logger.warn(e);
        return;
      }
    }

    return fullPath;
  }
}
