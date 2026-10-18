import path from 'path';
import type { ContentBackedStreamLineupItem } from '../db/derived_types/StreamLineup.ts';
import { globalOptions } from '../globals.ts';
import type { SubtitleStreamDetails } from '../stream/types.ts';
import type { Maybe } from '../types/util.ts';
import {
  CacheFolderName,
  SubtitlesCacheFolderName,
} from '../util/constants.ts';
import { fileExists } from '../util/fsUtil.ts';
import type { Logger } from '../util/logging/LoggerFactory.ts';
import { LoggerFactory } from '../util/logging/LoggerFactory.ts';
import { getSubtitleCacheFilePath } from '../util/subtitles.ts';

export class SubtitleStreamPicker {
  private static _logger?: Logger;
  private static get logger() {
    return (this._logger ??= LoggerFactory.child({
      className: SubtitleStreamPicker.name,
    }));
  }

  private static getCacheFolder() {
    // TODO: Fix, inject?
    return path.join(
      globalOptions().databaseDirectory,
      CacheFolderName,
      SubtitlesCacheFolderName,
    );
  }

  static async getSubtitleDetailsWithExtractedPath(
    lineupItem: ContentBackedStreamLineupItem,
    stream: SubtitleStreamDetails,
  ): Promise<Maybe<SubtitleStreamDetails>> {
    const cacheFolder = this.getCacheFolder();
    const filePath = getSubtitleCacheFilePath(
      {
        id: lineupItem.program.uuid,
        externalKey: lineupItem.program.externalKey,
        externalSourceId: lineupItem.program.mediaSourceId,
        externalSourceType: lineupItem.program.sourceType,
      },
      { streamIndex: stream.index, codec: stream.codec },
    );

    if (!filePath) {
      this.logger.debug(
        'Unsupported subtitle codec at index %d: codec = %s',
        stream.index ?? -1,
        stream.codec ?? 'unkonwn',
      );
      return;
    }

    const fullPath = path.join(cacheFolder, filePath);
    if (!(await fileExists(fullPath))) {
      this.logger.debug(
        'Subtitle stream at index %d has not been extracted yet.',
        stream.index ?? -1,
      );
      return;
    }

    return {
      ...stream,
      type: 'external',
      index: 0,
      path: fullPath,
    } satisfies SubtitleStreamDetails;
  }
}
