import { MediaStream } from '../../MediaStream.ts';
import { InputSource } from '../../input/InputSource.ts';
import { InputOption } from './InputOption.ts';

export class LavfiInputOption extends InputOption {
  options(): string[] {
    return ['-f', 'lavfi'];
  }

  appliesToInput(input: InputSource<MediaStream>): boolean {
    return input.type === 'video' || input.type === 'audio';
  }
}
