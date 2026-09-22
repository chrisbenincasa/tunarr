import type { MediaSourceId, MediaSourceType } from '@/db/schema/base.js';
import crypto from 'node:crypto';
import path from 'path';
import { match, P } from 'ts-pattern';
import type { Maybe, Nilable, Nullable } from '../types/util.ts';
import { isNonEmptyString } from './index.ts';

type MinimalProgram = {
  id: string;
  externalSourceType: MediaSourceType;
  externalSourceId: MediaSourceId;
  externalKey: string;
};

export function subtitleCodecToExt(codec: string): Nullable<string> {
  return match(codec)
    .with(P.union('srt', 'subrip', 'mov_text'), () => 'srt')
    .with('ass', () => 'ass')
    .with('webvtt', () => 'vtt')
    .otherwise(() => null);
}

/**
 * Builds the source-relative URL that a Jellyfin or Emby server uses to serve
 * an external (non-container) subtitle stream.
 *
 * External subtitles cannot be addressed by stream index at transcode time --
 * they are separate files -- so we persist this location and later resolve it
 * against the media source's URI. Returns undefined when the subtitle is in a
 * codec the server will not deliver as a standalone file (i.e. image-based
 * subtitles), since a URL we cannot read is worse than no URL at all.
 */
export function externalSubtitleDeliveryPath(
  itemId: Nilable<string>,
  mediaSourceId: Nilable<string>,
  stream: {
    Index?: Nilable<number>;
    Codec?: Nilable<string>;
    DeliveryUrl?: Nilable<string>;
  },
): Maybe<string> {
  if (isNonEmptyString(stream.DeliveryUrl)) {
    return stream.DeliveryUrl;
  }

  const ext = subtitleCodecToExt((stream.Codec ?? '').toLowerCase());
  if (
    !isNonEmptyString(itemId) ||
    stream.Index === null ||
    stream.Index === undefined ||
    !ext
  ) {
    return undefined;
  }

  const sourceId = isNonEmptyString(mediaSourceId) ? mediaSourceId : itemId;

  return `/Videos/${itemId}/${sourceId}/Subtitles/${stream.Index}/Stream.${ext}`;
}

export function getSubtitleCacheFilePath(
  program: MinimalProgram,
  subtitleStream: {
    streamIndex: Maybe<number>;
    codec: string;
    /**
     * Distinguishes subtitles that share a codec but have no stream index --
     * external subtitles -- so that, say, an English and a Spanish sidecar do
     * not hash to the same cache file.
     */
    key?: Nilable<string>;
  },
) {
  const outputPath = getSubtitleCacheFileName(
    program,
    subtitleStream.streamIndex,
    subtitleStream.codec,
    subtitleStream.key,
  );
  const ext = subtitleCodecToExt(subtitleStream.codec.toLowerCase());
  if (!ext) {
    return null;
  }

  return path.join(
    outputPath.slice(0, 2),
    outputPath.slice(outputPath.length - 2, outputPath.length),
    `${outputPath}.${ext}`,
  );
}

function getSubtitleCacheFileName(
  program: MinimalProgram,
  streamIndex: Maybe<number>,
  codec: string,
  key: Nilable<string>,
) {
  // TODO: We should not always include the external key in here. but it will bust the "cache"
  // if the underlying program changes at the target
  const hash = crypto
    .createHash('md5')
    .update(program.id)
    .update(program.externalSourceType)
    .update(program.externalSourceId)
    .update(program.externalKey)
    .update(streamIndex?.toString() ?? '')
    .update(codec);

  // Only mixed in when present, so that cache entries for indexed (embedded)
  // subtitles keep the names they were extracted under.
  if (isNonEmptyString(key)) {
    hash.update(key);
  }

  return hash.digest('hex');
}
