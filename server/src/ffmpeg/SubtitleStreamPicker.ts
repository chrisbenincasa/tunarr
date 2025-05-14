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
import { getSubtitleCacheFilePath } from '../util/subtitles.ts';

export class SubtitleStreamPicker {
  static async pickSubtitles(
    subtitlePreferences: ChannelSubtitlePreferences[],
    lineupItem: ContentBackedStreamLineupItem,
    subtitleStreams: NonEmptyArray<SubtitleStreamDetails>,
  ): Promise<Maybe<SubtitleStreamDetails>> {
    // TODO: Fix, inject?
    const cacheFolder = path.join(
      globalOptions().databaseDirectory,
      CacheFolderName,
      SubtitlesCacheFolderName,
    );

    for (const pref of orderBy(
      subtitlePreferences,
      (pref) => pref.priority,
      'asc',
    )) {
      if (pref.filterType === 'none') {
        continue;
      }

      // Try to find a match
      for (let stream of subtitleStreams) {
        // TODO: map a present 2 letter code to its 3 letter code and check that.
        if (stream.languageCodeISO6392 !== pref.languageCode) {
          continue;
        }

        // Check filter types
        if (pref.filterType === 'forced' && !stream.forced) {
          continue;
        } else if (pref.filterType === 'default' && !stream.default) {
          continue;
        }

        // Check subtitle type
        if (!pref.allowExternal && stream.type === 'external') {
          continue;
        }

        if (!pref.allowImageBased && isImageBasedSubtitle(stream.codec)) {
          continue;
        }

        // TODO: check if embedded text based are extracted and continue searching
        // for a fallback if they are not.
        if (!isImageBasedSubtitle(stream.codec) && stream.type === 'embedded') {
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
            continue;
          }
          const fullPath = path.join(cacheFolder, filePath);
          if (!(await fileExists(fullPath))) {
            continue;
          }

          stream = {
            ...stream,
            path: fullPath,
          };
        }

        return stream;
      }
    }

    return;
  }
}
