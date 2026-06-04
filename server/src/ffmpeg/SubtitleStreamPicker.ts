import { orderBy } from 'lodash-es';
import path from 'path';
import type { NonEmptyArray } from 'ts-essentials';
import type { ContentBackedStreamLineupItem } from '../db/derived_types/StreamLineup.ts';
import type { ChannelSubtitlePreferences } from '../db/schema/SubtitlePreferences.ts';
import { globalOptions } from '../globals.ts';
import { LanguageService } from '../services/LanguageService.ts';
import type { SubtitleStreamDetails } from '../stream/types.ts';
import { isImageBasedSubtitle } from '../stream/util.ts';
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

  static async pickSubtitles(
    subtitlePreferences: ChannelSubtitlePreferences[],
    lineupItem: ContentBackedStreamLineupItem,
    subtitleStreams: NonEmptyArray<SubtitleStreamDetails>,
    opts: { preferTextBased?: boolean } = {},
  ): Promise<Maybe<SubtitleStreamDetails>> {
    const orderedStreams = opts.preferTextBased
      ? (orderBy(
          subtitleStreams,
          (s) => isImageBasedSubtitle(s.codec),
          'desc',
        ) as NonEmptyArray<SubtitleStreamDetails>)
      : subtitleStreams;
    if (subtitlePreferences.length === 0) {
      this.logger.debug(
        'No subtitle preferences for channel. Attempting to use default stream.',
      );
      const defaultStream = orderedStreams.find((stream) => stream.default);
      const defaultOrFirstStream = defaultStream ?? orderedStreams[0];
      if (!defaultStream) {
        this.logger.debug('Could not find default subtitle stream');
      }

      let foundStream: Maybe<SubtitleStreamDetails> = defaultOrFirstStream;
      if (
        !opts.preferTextBased &&
        !isImageBasedSubtitle(defaultOrFirstStream.codec) &&
        defaultOrFirstStream.type === 'embedded'
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
      for (const stream of orderedStreams) {
        if (
          stream.languageCodeISO6392 &&
          LanguageService.getAlpha3TCode(stream.languageCodeISO6392) !==
            pref.languageCode
        ) {
          this.logger.debug(
            'Skipping subtitle index %d, not a language match',
            stream.index ?? -1,
          );
          continue;
        }

        // Check filter types
        if (pref.filterType === 'forced' && !stream.forced) {
          this.logger.debug(
            'Skipping subtitle index %d, wanted forced',
            stream.index ?? -1,
          );
          continue;
        } else if (pref.filterType === 'default' && !stream.default) {
          this.logger.debug(
            'Skipping subtitle index %d, wanted default',
            stream.index ?? -1,
          );
          continue;
        }

        // Check subtitle type
        if (!pref.allowExternal && stream.type === 'external') {
          this.logger.debug(
            'Skipping subtitle index %d, disallowed external',
            stream.index ?? -1,
          );
          continue;
        }

        if (!pref.allowImageBased && isImageBasedSubtitle(stream.codec)) {
          this.logger.debug(
            'Skipping subtitle index %d, disallowed image-based',
            stream.index ?? -1,
          );
          continue;
        }

        // TODO: check if embedded text based are extracted and continue searching
        // for a fallback if they are not.
        if (!isImageBasedSubtitle(stream.codec) && stream.type === 'embedded') {
          if (opts.preferTextBased) {
            return stream;
          }
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
