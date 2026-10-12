import type { InputSource } from '@/ffmpeg/builder/input/InputSource.js';
import { InputOption } from './InputOption.ts';

/**
 * Forces ffmpeg to treat a subsequent -ss as an absolute container
 * timestamp rather than one relative to the input's own start_time
 * (e.g. an SRT/VTT file's first cue). Without this, seeking a subtitle
 * file whose first cue is at t>0 overshoots by that amount.
 */
export class SeekTimestampInputOption extends InputOption {
  appliesToInput(_input: InputSource): boolean {
    return true;
  }

  options(): string[] {
    return ['-seek_timestamp', '1'];
  }
}
