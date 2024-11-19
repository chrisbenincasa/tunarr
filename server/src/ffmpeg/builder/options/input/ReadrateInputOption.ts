import { MediaStream } from '@/ffmpeg/builder/MediaStream.ts';
import { FfmpegCapabilities } from '@/ffmpeg/builder/capabilities/FfmpegCapabilities.ts';
import { NullAudioInputSource } from '@/ffmpeg/builder/input/AudioInputSource.ts';
import { ConcatInputSource } from '@/ffmpeg/builder/input/ConcatInputSource.ts';
import { InputSource } from '@/ffmpeg/builder/input/InputSource.ts';
import { KnownFfmpegOptions } from '@/ffmpeg/builder/options/KnownFfmpegOptions.ts';
import { FrameState } from '@/ffmpeg/builder/state/FrameState.ts';
import { every } from 'lodash-es';
import { InputOption } from './InputOption.ts';

export class ReadrateInputOption extends InputOption {
  constructor(
    private capabilities: FfmpegCapabilities,
    private initialBurstSeconds: number,
  ) {
    super();
  }

  appliesToInput(input: InputSource<MediaStream>): boolean {
    switch (input.type) {
      case 'video': {
        if (input instanceof ConcatInputSource) {
          return true;
        }
        return every(input.streams, (stream) => stream.kind !== 'stillimage');
      }
      case 'audio':
        return !(input instanceof NullAudioInputSource);
    }
  }

  options(): string[] {
    const opts = ['-readrate', '1.0'];
    if (this.shouldBurst()) {
      opts.push('-readrate_initial_burst', `${this.initialBurstSeconds}`);
    }
    return opts;
  }

  nextState(currentState: FrameState): FrameState {
    return currentState.update({
      realtime: true, // TODO: is this true based on the burst...?
    });
  }

  private shouldBurst() {
    // TODO: Should we log on missing option?
    return (
      this.initialBurstSeconds > 0 &&
      this.capabilities.hasOption(KnownFfmpegOptions.ReadrateInitialBurst)
    );
  }
}
