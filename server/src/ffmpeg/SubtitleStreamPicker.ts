import { orderBy } from 'lodash-es';
import path from 'path';
import type { NonEmptyArray } from 'ts-essentials';
import type { ContentBackedStreamLineupItem } from '../db/derived_types/StreamLineup.ts';
import type { ChannelSubtitlePreferences } from '../db/schema/SubtitlePreferences.ts';
import { globalOptions } from '../globals.ts';
import type { SubtitleStreamDetails } from '../stream/types.ts';
import { isImageBasedSubtitle } from '../stream/util.ts';
import type { Maybe } from '../types/util.ts';
import {
  CacheFolderName,
  SubtitlesCacheFolderName,
} from '../util/constants.ts';
import { fileExists } from '../util/fsUtil.ts';
import { LoggerFactory } from '../util/logging/LoggerFactory.ts';
import { getSubtitleCacheFilePath } from '../util/subtitles.ts';

export class SubtitleStreamPicker {
  private static logger = LoggerFactory.child({
    className: SubtitleStreamPicker.name,
  });

  private static getCacheFolder() {
    // TODO: Fix, inject?
    return path.join(
      globalOptions().databaseDirectory,
      CacheFolderName,
      SubtitlesCacheFolderName,
    );
  }

  static async pickSubtitles(
    subtitlePreferences: ChannelSubtitlePreferences[],
    lineupItem: ContentBackedStreamLineupItem,
    subtitleStreams: NonEmptyArray<SubtitleStreamDetails>,
  ): Promise<Maybe<SubtitleStreamDetails>> {
    if (subtitlePreferences.length === 0) {
      this.logger.debug(
        'No subtitle preferences for channel. Attempting to use default stream.',
      );
      let foundStream = subtitleStreams.find((stream) => stream.default);
      if (!foundStream) {
        this.logger.debug('Could not find default subtitle stream');
        return;
      }

      if (
        !isImageBasedSubtitle(foundStream.codec) &&
        foundStream.type === 'embedded'
      ) {
        foundStream = await this.getSubtitleDetailsWithExtractedPath(
          lineupItem,
          foundStream,
        );
      }

      return foundStream;
    }

    for (const pref of orderBy(
      subtitlePreferences,
      (pref) => pref.priority,
      'asc',
    )) {
      this.logger.debug(
        'Attempting to find subtitle match for preference: %O',
        pref,
      );

      if (pref.filterType === 'none') {
        continue;
      }

      // Try to find a match
      for (const stream of subtitleStreams) {
        // TODO: map a present 2 letter code to its 3 letter code and check that.
        if (stream.languageCodeISO6392 !== pref.languageCode) {
          this.logger.debug(
            'Skipping subtitle index %d, not a language match',
            stream.index,
          );
          continue;
        }

        // Check filter types
        if (pref.filterType === 'forced' && !stream.forced) {
          this.logger.debug(
            'Skipping subtitle index %d, wanted forced',
            stream.index,
          );
          continue;
        } else if (pref.filterType === 'default' && !stream.default) {
          this.logger.debug(
            'Skipping subtitle index %d, wanted default',
            stream.index,
          );
          continue;
        }

        // Check subtitle type
        if (!pref.allowExternal && stream.type === 'external') {
          this.logger.debug(
            'Skipping subtitle index %d, disallowed external',
            stream.index,
          );
          continue;
        }

        if (!pref.allowImageBased && isImageBasedSubtitle(stream.codec)) {
          this.logger.debug(
            'Skipping subtitle index %d, disallowed image-based',
            stream.index,
          );
          continue;
        }

        // Temporarily skip pgs subs that break ffmpeg
        // Workaround for #1272
        const knownOverlayIssues = ['pgs', 'pgssub', 'hdmv_pgs_subtitle'];
        if (knownOverlayIssues.includes(stream.codec)) {
          this.logger.debug(
            'Skipping subtitle index %d, potentially crashing subtitle',
            stream.index,
          );
          continue;
        }

        // TODO: check if embedded text based are extracted and continue searching
        // for a fallback if they are not.
        if (!isImageBasedSubtitle(stream.codec) && stream.type === 'embedded') {
          const streamWithUpdatedPath =
            await this.getSubtitleDetailsWithExtractedPath(lineupItem, stream);
          if (streamWithUpdatedPath) {
            return streamWithUpdatedPath;
          }

          continue;
        }

        return stream;
      }
    }

    return;
  }

  static async getSubtitleDetailsWithExtractedPath(
    lineupItem: ContentBackedStreamLineupItem,
    stream: SubtitleStreamDetails,
  ) {
    const cacheFolder = this.getCacheFolder();
    const filePath = getSubtitleCacheFilePath(
      {
        id: lineupItem.programId,
        externalKey: lineupItem.externalKey,
        externalSourceId: lineupItem.externalSourceId,
        externalSourceType: lineupItem.externalSource,
      },
      stream,
    );

    if (!filePath) {
      this.logger.debug(
        'Unsupported subtitle codec at index %d: %s',
        stream.index,
        stream.codec,
      );
      return;
    }

    const fullPath = path.join(cacheFolder, filePath);
    if (!(await fileExists(fullPath))) {
      this.logger.debug(
        'Subtitle stream at index %d has not been extracted yet.',
        stream.index,
      );
      return;
    }

    return {
      ...stream,
      path: fullPath,
    };
  }
}
