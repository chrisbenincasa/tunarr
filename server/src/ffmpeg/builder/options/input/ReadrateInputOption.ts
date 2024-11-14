import { every } from 'lodash-es';
import { MediaStream } from '../../MediaStream.ts';
import { FfmpegCapabilities } from '../../capabilities/FfmpegCapabilities.ts';
import { NullAudioInputSource } from '../../input/AudioInputSource.ts';
import { ConcatInputSource } from '../../input/ConcatInputSource.ts';
import { InputSource } from '../../input/InputSource.ts';
import { FrameState } from '../../state/FrameState.ts';
import { KnownFfmpegOptions } from '../KnownFfmpegOptions.ts';
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
