import { identity } from 'lodash-es';
import { Option } from './Option';
import { FrameState } from '../state/FrameState';

export abstract class OutputOption implements Option {
  // globalOptions = constant([]);
  // filterOptions = constant([]);
  // inputOptions = constant([]);
  readonly type = 'output';
  readonly affectsFrameState: boolean = false;
  nextState = identity<FrameState>;
  abstract options(): string[];
  // env vars
}

export abstract class ConstantOutputOption extends OutputOption {
  constructor(private _options: string[]) {
    super();
  }

  options(): string[] {
    return this._options;
  }
}

// export function makeConstantOutputOption
export function makeConstantOutputOption(opts: string[]): ConstantOutputOption {
  return new (class extends ConstantOutputOption {})(opts);
}

export const ClosedGopOutputOption = () =>
  makeConstantOutputOption(['-flags', 'cgop']);

export const NoDemuxDecodeDelayOutputOption = () =>
  makeConstantOutputOption(['-muxdelay', '0', '-muxpreload', '0']);

export const FastStartOutputOption = () =>
  makeConstantOutputOption(['-movflags', '+faststart']);

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

export const MpegTsOutputFormatOption = () =>
  makeConstantOutputOption([
    '-f',
    'mpegts',
    '-mpegts_flags',
    '+initial_discontinuity',
  ]);

export const PipeProtocolOutputOption = (fd: number = 1) =>
  makeConstantOutputOption([`pipe:${fd}`]);
