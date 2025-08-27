import type { Maybe } from '@/types/util.js';
import type { ChannelStreamMode, Watermark } from '@tunarr/types';
import type { ChannelConcatStreamMode } from '@tunarr/types/schemas';
import type { Duration } from 'dayjs/plugin/duration.js';
import type { DeepReadonly, StrictExclude } from 'ts-essentials';
import type { ContentBackedStreamLineupItem } from '../db/derived_types/StreamLineup.ts';
import type { StreamDetails, StreamSource } from '../stream/types.ts';
import type { OutputFormat } from './builder/constants.ts';
import type { FfmpegTranscodeSession } from './FfmpegTrancodeSession.ts';

export type HlsWrapperOptions = DeepReadonly<
  Omit<ConcatOptions, 'mode'> & {
    mode: StrictExclude<ChannelConcatStreamMode, 'mpegts_concat'>;
  }
>;

export const ConcatStreamModeToChildMode: Record<
  ChannelConcatStreamMode,
  ChannelStreamMode
> = {
  hls_concat: 'hls',
  hls_slower_concat: 'hls_slower',
  mpegts_concat: 'mpegts',
  hls_direct_concat: 'hls_direct',
} as const;

export abstract class IFFMPEG {
  /**
   * Creates an ffmpeg concat stream using the ffconcat file returned by the {@link streamUrl}
   * @param streamUrl URL which returns a text file in ffconcat format
   */
  abstract createConcatSession(
    streamUrl: string,
    opts: DeepReadonly<ConcatOptions>,
  ): Promise<FfmpegTranscodeSession>;

  /**
   * Creates a stream which "wraps" HLS output (e.g. concatenates HLS segments).
   * The {@link streamUrl} should return an m3u8 playlist.
   * @param streamUrl
   * @param opts
   */
  abstract createHlsWrapperSession(
    streamUrl: string,
    opts: HlsWrapperOptions,
  ): Promise<FfmpegTranscodeSession>;

  /**
   * Creates an arbitrary stream session for the input
   * @param streamSessionOptions
   */
  abstract createStreamSession(
    streamSessionOptions: StreamSessionCreateArgs,
  ): Promise<Maybe<FfmpegTranscodeSession>>;

  abstract createErrorSession(
    title: string,
    subtitle: Maybe<string>,
    duration: Duration,
    outputFormat: OutputFormat,
    realtime: boolean,
    ptsOffset?: number,
  ): Promise<Maybe<FfmpegTranscodeSession>>;

  abstract createOfflineSession(
    duration: Duration,
    outputFormat: OutputFormat,
    ptsOffset?: number,
    realtime?: boolean,
  ): Promise<Maybe<FfmpegTranscodeSession>>;
}
export type StreamSessionCreateArgs = {
  stream: {
    source: StreamSource;
    details: StreamDetails;
  };
  options: StreamOptions;
  lineupItem: ContentBackedStreamLineupItem;
};
export type ConcatOptions = {
  mode: ChannelConcatStreamMode;
  outputFormat: OutputFormat;
};
export type StreamOptions = {
  startTime: Duration;
  duration: Duration;
  watermark?: Watermark;
  realtime?: boolean; // = true,
  extraInputHeaders?: Record<string, string>;
  outputFormat: OutputFormat;
  ptsOffset?: number;
  streamMode: ChannelStreamMode;
};
