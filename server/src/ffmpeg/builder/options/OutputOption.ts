import { constant } from 'lodash-es';
import { Option } from './Option';

export abstract class OutputOption extends Option {
  globalOptions = constant([]);
  filterOptions = constant([]);
  inputOptions = constant([]);
  // env vars
}

export abstract class ConstantOutputOption extends OutputOption {
  constructor(private options: [string, ...string[]]) {
    super();
  }

  outputOptions(): string[] {
    return this.options;
  }
}

function makeConstantOutputOption(
  opts: [string, ...string[]],
): ConstantOutputOption {
  return new (class extends ConstantOutputOption {})(opts);
}

const NoSceneDetectOutputOption = (value: number): ConstantOutputOption =>
  makeConstantOutputOption(['-sc_threshold', value.toString(10)]);

const TimeLimitOutputOption = (finish: string): ConstantOutputOption =>
  makeConstantOutputOption(['-t', finish]);

const VideoBitrateOutputOption = (bitrate: number): ConstantOutputOption =>
  makeConstantOutputOption([
    '-b:v',
    `${bitrate.toString(10)}k`,
    '-maxrate:v',
    `${bitrate.toString(10)}k`,
  ]);
