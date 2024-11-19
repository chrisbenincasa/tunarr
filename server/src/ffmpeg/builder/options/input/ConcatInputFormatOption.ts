import { MediaStream } from '@/ffmpeg/builder/MediaStream.ts';
import { ConcatInputSource } from '@/ffmpeg/builder/input/ConcatInputSource.ts';
import { InputSource } from '@/ffmpeg/builder/input/InputSource.ts';
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
