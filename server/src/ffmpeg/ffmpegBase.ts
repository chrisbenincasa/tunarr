import { ConcatSessionType } from '@/stream/Session.ts';
import { Maybe } from '@/types/util.ts';
import { Duration } from 'dayjs/plugin/duration.js';
import { DeepReadonly, StrictExclude } from 'ts-essentials';
import { FfmpegTranscodeSession } from './FfmpegTrancodeSession.ts';
import { OutputFormat } from './builder/constants.ts';
import { ConcatOptions, StreamSessionOptions } from './ffmpeg.ts';

export type HlsWrapperOptions = DeepReadonly<
  Omit<ConcatOptions, 'mode'> & {
    mode: StrictExclude<ConcatSessionType, 'mpegts_concat'>;
  }
>;

export const ConcatStreamModeToChildMode = {
  hls_concat: 'hls',
  hls_slower_concat: 'hls_slower',
  mpegts_concat: 'mpegts',
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
    streamSessionOptions: StreamSessionOptions,
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
