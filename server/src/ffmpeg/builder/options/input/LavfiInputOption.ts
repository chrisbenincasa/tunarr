import type { MediaStream } from '@/ffmpeg/builder/MediaStream.js';
import type { InputSource } from '@/ffmpeg/builder/input/InputSource.js';
import { InputOption } from './InputOption.ts';

export class LavfiInputOption extends InputOption {
  options(): string[] {
    return ['-f', 'lavfi'];
  }

  appliesToInput(input: InputSource<MediaStream>): boolean {
    return input.type === 'video' || input.type === 'audio';
  }
}
