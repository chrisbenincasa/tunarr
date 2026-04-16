import type { MediaSourceId, MediaSourceType } from '@/db/schema/base.js';
import crypto from 'node:crypto';
import path from 'path';
import { match, P } from 'ts-pattern';
import type { Maybe, Nullable } from '../types/util.ts';

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

export function getSubtitleCacheFilePath(
  program: MinimalProgram,
  subtitleStream: { streamIndex: Maybe<number>; codec: string },
) {
  const outputPath = getSubtitleCacheFileName(
    program,
    subtitleStream.streamIndex,
    subtitleStream.codec,
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
) {
  // TODO: We should not always include the external key in here. but it will bust the "cache"
  // if the underlying program changes at the target
  return crypto
    .createHash('md5')
    .update(program.id)
    .update(program.externalSourceType)
    .update(program.externalSourceId)
    .update(program.externalKey)
    .update(streamIndex?.toString() ?? '')
    .update(codec)
    .digest('hex');
}
