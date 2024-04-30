import { every } from 'lodash-es';
import { InputSource } from '../../input/InputSource.ts';
import { InputOption } from './InputOption.ts';

export class DoNotIgnoreLoopInputOption extends InputOption {
  options(): string[] {
    return ['-ignore_loop', '0'];
  }

  appliesToInput(input: InputSource): boolean {
    return (
      input.isVideo() &&
      every(input.streams, (stream) => stream.inputKind === 'stillimage')
    );
  }
}
