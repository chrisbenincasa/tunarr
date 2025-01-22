import type { MediaStream } from '@/ffmpeg/builder/MediaStream.js';
import { ConcatInputSource } from '@/ffmpeg/builder/input/ConcatInputSource.js';
import type { InputSource } from '@/ffmpeg/builder/input/InputSource.js';
import { InputOption } from './InputOption.ts';

export class ConcatInputFormatOption extends InputOption {
  appliesToInput(input: InputSource<MediaStream>): boolean {
    return input instanceof ConcatInputSource;
  }

  options(): string[] {
    return [
      '-f',
      'concat',
      '-safe',
      '0',
      '-protocol_whitelist',
      'file,http,tcp,https,tls',
      '-probesize',
      '32',
    ];
  }
}
