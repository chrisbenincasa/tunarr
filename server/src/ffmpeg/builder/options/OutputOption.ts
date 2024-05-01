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

export const NoSceneDetectOutputOption = (
  value: number,
): ConstantOutputOption =>
  makeConstantOutputOption(['-sc_threshold', value.toString(10)]);

export const TimeLimitOutputOption = (finish: string): ConstantOutputOption =>
  makeConstantOutputOption(['-t', finish]);

export const VideoBitrateOutputOption = (
  bitrate: number,
): ConstantOutputOption =>
  makeConstantOutputOption([
    '-b:v',
    `${bitrate.toString(10)}k`,
    '-maxrate:v',
    `${bitrate.toString(10)}k`,
  ]);

export const VideoBufferSizeOutputOption = (
  bufferSize: number,
): ConstantOutputOption =>
  makeConstantOutputOption(['-bufsize:v', `${bufferSize}k`]);

export const FrameRateOutputOption = (
  frameRate: number,
): ConstantOutputOption =>
  makeConstantOutputOption(['-r', frameRate.toString(10), '-vsync', 'cfr']);

export const VideoTrackTimescaleOutputOption = (scale: number) =>
  makeConstantOutputOption(['video_track_timescale', scale.toString()]);
