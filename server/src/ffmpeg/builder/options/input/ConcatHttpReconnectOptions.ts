import { MediaStream } from '../../MediaStream.ts';
import { InputSource } from '../../input/InputSource.ts';
import { InputOption } from './InputOption.ts';

export class ConcatHttpReconnectOptions extends InputOption {
  appliesToInput(input: InputSource<MediaStream>): boolean {
    return input.protocol === 'http' && input.continuity === 'infinite';
  }

  options(): string[] {
    return ['-reconnect', '1', '-reconnect_at_eof', '1'];
  }

  affectsFrameState: boolean = false;
}
