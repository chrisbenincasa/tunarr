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

  // Not a singleton: FfmpegInfo captures KEYS.FFmpegPath / KEYS.FFprobePath at
  // construction, and those are bound transiently so a settings change takes
  // effect without a restart.
  bind(FfmpegInfo).toSelf();
  bind(StreamSelector).toSelf().inSingletonScope();
});

export { FFmpegModule };
