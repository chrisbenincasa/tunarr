import type { TranscodeConfigOrm } from '@/db/schema/TranscodeConfig.js';
import { FfmpegStreamFactory } from '@/ffmpeg/FfmpegStreamFactory.js';
import { KEYS } from '@/types/inject.js';
import { ContainerModule } from 'inversify';
import type { ChannelOrm } from '../db/schema/Channel.ts';
import { bindAssistedFactory } from '../util/assistedInject.ts';
import { FfmpegInfo } from './ffmpegInfo.ts';
import { StreamSelector } from './StreamSelector.ts';

export type FFmpegAssistedFactory = (
  transcodeConfig: TranscodeConfigOrm,
  channel: ChannelOrm,
) => FfmpegStreamFactory;

const FFmpegModule = new ContainerModule(({ bind }) => {
  bindAssistedFactory<FfmpegStreamFactory, FFmpegAssistedFactory>(
    bind,
    KEYS.FFmpegFactory,
    FfmpegStreamFactory,
  );

  bind(FfmpegInfo).toSelf().inSingletonScope();
  bind(StreamSelector).toSelf().inSingletonScope();
});

export { FFmpegModule };
