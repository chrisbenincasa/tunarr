import { constant, identity } from 'lodash-es';
import { PipelineStep, InputFile } from '../types';

export interface InputOption extends PipelineStep {
  //
  appliesToInput(input: InputFile): boolean;
}

const BaseInputOption: Omit<InputOption, 'inputOptions' | 'appliesToInput'> = {
  filterOptions: constant([]),
  outputOptions: constant([]),
  globalOptions: constant([]),
  nextState: identity,
};

export function StreamSeekOption(start: string): InputOption {
  return {
    ...BaseInputOption,
    // TODO: we shouldn't seek into a still image,
    appliesToInput: constant(true),
    inputOptions: constant(['-ss', start]),
  };
}

export function RealtimeInputOption(): InputOption {
  return {
    ...BaseInputOption,
    // TODO: Do not apply to still image
    appliesToInput: constant(true),
    inputOptions: constant(['-re']),
  };
}
