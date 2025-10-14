import { inject, injectable } from 'inversify';
import fs from 'node:fs/promises';
import path from 'path';
import { StreamLineupProgram } from '../db/derived_types/StreamLineup.ts';
import { QueryResult } from '../external/BaseApiClient.ts';
import { FileSystemService } from '../services/FileSystemService.ts';
import { KEYS } from '../types/inject.ts';
import { fileExists } from '../util/fsUtil.ts';
import { Logger } from '../util/logging/LoggerFactory.ts';
import {
  getSubtitleCacheFilePath,
  subtitleCodecToExt,
} from '../util/subtitles.ts';
import { SubtitleStreamDetails } from './types.ts';

type GetSubtitleCallbackArgs = {
  extension: string;
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
    item: StreamLineupProgram,
    details: SubtitleStreamDetails,
    getSubtitlesCb: (
      args: GetSubtitleCallbackArgs,
    ) => Promise<QueryResult<string>>,
  ) {
    const outPath = getSubtitleCacheFilePath(
      {
        externalKey: item.externalKey,
        externalSourceId: item.externalSourceId,
        externalSourceType: item.sourceType,
        id: item.uuid,
      },
      details,
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
          'Error while requesting external subtitle stream from Jellyfin: %s',
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
