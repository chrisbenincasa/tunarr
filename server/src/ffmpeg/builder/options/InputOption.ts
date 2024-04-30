import { constant } from 'lodash-es';
import { FrameState } from '../state/FrameState';
import { InputSource } from '../types';
import { Option } from './Option';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export abstract class InputOption implements Option<[InputSource]> {
  readonly type = 'input';
  readonly affectsFrameState: boolean = false;

  abstract appliesToInput(input: InputSource): boolean;

  abstract options(inputSource: InputSource): string[];

  nextState(currentState: FrameState) {
    return currentState;
  }
}

// const BaseInputOption: Omit<InputOption, 'inputOptions' | 'appliesToInput'> = {
//   filterOptions: constant([]),
//   outputOptions: constant([]),
//   globalOptions: constant([]),
//   nextState: identity,
// };

export class StreamSeekInputOption extends InputOption {
  constructor(private start: string) {
    super();
  }

  appliesToInput = constant(true);
  options = () => ['-ss', this.start];
}

// export function StreamSeekOption(start: string): InputOption {
//   return {
//     ...BaseInputOption,
//     // TODO: we shouldn't seek into a still image,
//     appliesToInput: constant(true),
//     inputOptions: constant(['-ss', start]),
//   };
// }

export class RealtimeInputOption extends InputOption {
  appliesToInput = constant(true);
  options = constant(['-re']);
}

// export function RealtimeInputOption(): InputOption {
//   return {
//     ...BaseInputOption,
//     // TODO: Do not apply to still image
//     appliesToInput: constant(true),
//     inputOptions: constant(['-re']),
//   };
// }
