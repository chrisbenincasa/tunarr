import type { MediaStream } from '@/ffmpeg/builder/MediaStream.js';
import type { FfmpegCapabilities } from '@/ffmpeg/builder/capabilities/FfmpegCapabilities.js';
import { NullAudioInputSource } from '@/ffmpeg/builder/input/AudioInputSource.js';
import { ConcatInputSource } from '@/ffmpeg/builder/input/ConcatInputSource.js';
import type { InputSource } from '@/ffmpeg/builder/input/InputSource.js';
import { KnownFfmpegOptions } from '@/ffmpeg/builder/options/KnownFfmpegOptions.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import { every } from 'lodash-es';
import { InputOption } from './InputOption.ts';

// FFmpeg 8 catches up after a stall at 1.05x the readrate by default, so a
// 3 s stall takes about a minute to recover. FFmpeg 7 read at full speed until
// caught up. A high catch-up rate restores the FFmpeg 7 behavior.
export const ReadrateCatchupSpeed = 100;

export class ReadrateInputOption extends InputOption {
  constructor(
    private capabilities: FfmpegCapabilities,
    private initialBurstSeconds: number,
    private readrate: number = 1.0,
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
      case 'subtitle':
        return false;
    }
  }

  options(): string[] {
    const opts = ['-readrate', `${this.readrate}`];
    if (this.shouldBurst()) {
      opts.push('-readrate_initial_burst', `${this.initialBurstSeconds}`);
    }
    if (this.capabilities.hasOption(KnownFfmpegOptions.ReadrateCatchup)) {
      opts.push(
        '-readrate_catchup',
        `${Math.max(ReadrateCatchupSpeed, this.readrate)}`,
      );
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
