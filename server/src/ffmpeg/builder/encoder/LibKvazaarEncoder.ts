import { VideoFormats } from '@/ffmpeg/builder/constants.js';
import { HardwareDownloadFilter } from '@/ffmpeg/builder/filter/HardwareDownloadFilter.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import type { Nullable } from '@/types/util.js';
import { isNonEmptyString } from '@/util/index.js';
import { VideoEncoder } from './BaseEncoder.js';

export class LibKvazaarEncoder extends VideoEncoder {
  protected readonly videoFormat = VideoFormats.Hevc;
  readonly affectsFrameState = true;

  get filter() {
    return new HardwareDownloadFilter(this.currentState).filter;
  }

  constructor(
    private currentState: FrameState,
    private videoPreset: Nullable<string>,
  ) {
    super('libkvazaar');
  }

  options(): string[] {
    const opts = [...super.options()];
    if (isNonEmptyString(this.videoPreset)) {
      opts.push('-kvazaar-params', `preset=${this.videoPreset}`);
    }
    return opts;
  }

  updateFrameState(currentState: FrameState): FrameState {
    return super.updateFrameState(currentState).update({
      frameDataLocation: 'software',
    });
  }
}
