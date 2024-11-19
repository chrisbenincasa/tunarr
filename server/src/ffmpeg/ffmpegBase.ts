import { Maybe } from '@/types/util.ts';
import { ChannelStreamMode } from '@tunarr/types';
import { Duration } from 'dayjs/plugin/duration.js';
import { DeepReadonly } from 'ts-essentials';
import { FfmpegTranscodeSession } from './FfmpegTrancodeSession.ts';
import { OutputFormat } from './builder/constants.ts';
import { ConcatOptions, StreamSessionOptions } from './ffmpeg.ts';

export abstract class IFFMPEG {
  abstract createConcatSession(
    streamUrl: string,
    opts: DeepReadonly<Partial<ConcatOptions>>,
  ): Promise<FfmpegTranscodeSession>;

  abstract createWrapperConcatSession(
    streamUrl: string,
    streamMode: ChannelStreamMode,
  ): Promise<FfmpegTranscodeSession>;

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
  ): Promise<Maybe<FfmpegTranscodeSession>>;
}
