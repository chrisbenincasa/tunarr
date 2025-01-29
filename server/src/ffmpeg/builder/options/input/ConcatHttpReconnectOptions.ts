import type { MediaStream } from '@/ffmpeg/builder/MediaStream.js';
import type { InputSource } from '@/ffmpeg/builder/input/InputSource.js';
import { InputOption } from '@/ffmpeg/builder/options/input/InputOption.js';

export class ConcatHttpReconnectOptions extends InputOption {
  appliesToInput(input: InputSource<MediaStream>): boolean {
    return input.protocol === 'http' && input.continuity === 'infinite';
  }

  options(): string[] {
    return ['-reconnect', '1', '-reconnect_at_eof', '1'];
  }

  affectsFrameState: boolean = false;
}
