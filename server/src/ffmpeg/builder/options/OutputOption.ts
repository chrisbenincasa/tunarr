import type { PixelFormat } from '@/ffmpeg/builder/format/PixelFormat.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import type { OutputOptionPipelineStep } from '@/ffmpeg/builder/types/PipelineStep.js';
import type { Duration } from 'dayjs/plugin/duration.js';

export abstract class OutputOption implements OutputOptionPipelineStep {
  readonly type = 'output';

  readonly affectsFrameState: boolean = false;

  nextState(currentState: FrameState): FrameState {
    return currentState;
  }

  abstract options(): string[];
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

export const Mp4OutputOptions = () =>
  makeConstantOutputOption([
    '-movflags',
    '+faststart+frag_keyframe+separate_moof+omit_tfhd_offset+empty_moov+delay_moov',
  ]);

export const MetadataServiceProviderOutputOption = (serviceProvider: string) =>
  makeConstantOutputOption([
    '-metadata',
    `service_provider="${serviceProvider}"`,
  ]);

export const MetadataServiceNameOutputOption = (serviceName: string) =>
  makeConstantOutputOption(['-metadata', `service_name="${serviceName}"`]);

export const DoNotMapMetadataOutputOption = () =>
  makeConstantOutputOption(['-map_metadata', '-1']);

export const MapAllStreamsOutputOption = () =>
  makeConstantOutputOption(['-map', '0']);

export const NoSceneDetectOutputOption = (
  value: number,
): ConstantOutputOption =>
  makeConstantOutputOption(['-sc_threshold', value.toString(10)]);

export const TimeLimitOutputOption = (finish: Duration): ConstantOutputOption =>
  makeConstantOutputOption(['-t', `${finish.asMilliseconds()}ms`]);

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

export const VideoTrackTimescaleOutputOption = (scale: number) =>
  makeConstantOutputOption(['-video_track_timescale', scale.toString()]);

export const MpegTsOutputFormatOption = (initialDiscontinuity?: boolean) =>
  makeConstantOutputOption([
    '-f',
    'mpegts',
    ...(initialDiscontinuity
      ? ['-mpegts_flags', '+initial_discontinuity']
      : []),
  ]);

export const Mp4OutputFormatOption = () =>
  makeConstantOutputOption(['-f', 'mp4']);

export const MatroskaOutputFormatOption = () =>
  makeConstantOutputOption(['-f', 'matroska']);

export const NutOutputFormatOption = () =>
  makeConstantOutputOption(['-f', 'nut']);

export const PipeProtocolOutputOption = (fd: number = 1) =>
  makeConstantOutputOption([`pipe:${fd}`]);

export const NoAutoScaleOutputOption = () =>
  makeConstantOutputOption(['-noautoscale']);

export const OutputTsOffsetOption = (
  ptsOffset: number,
  videoTrackTimeScale: number,
) =>
  makeConstantOutputOption([
    '-output_ts_offset',
    `${ptsOffset / videoTrackTimeScale}`,
  ]);

export class PixelFormatOutputOption extends OutputOption {
  constructor(private pixelFormat: PixelFormat) {
    super();
  }

  options(): string[] {
    return ['-pix_fmt', this.pixelFormat.name];
  }

  nextState(currentState: FrameState): FrameState {
    return currentState.update({
      pixelFormat: this.pixelFormat,
    });
  }
}
