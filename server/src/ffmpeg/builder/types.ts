import { TupleToUnion } from '../../types/util';
import { AudioStream, VideoStream } from './MediaStream';
import { PipelineFilterStep } from './filter/PipelineFilterStep';
import { AudioState } from './state/AudioState';
import { FrameState } from './state/FrameState';

export const HardwareAccelerationModes = [
  'none',
  'qsv',
  'nvenc',
  'vaapi',
  'videotoolbox',
  'amf',
] as const;

export type HardwareAccelerationMode = TupleToUnion<
  typeof HardwareAccelerationModes
>;

export const StreamKinds = ['audio', 'video', 'all'] as const;

export type StreamKind = TupleToUnion<typeof StreamKinds>;

export const FrameDataLocations = ['unknown', 'hardware', 'software'] as const;

export type FrameDataLocation = TupleToUnion<typeof FrameDataLocations>;

export interface PixelFormat {
  name: string;
  // Name used in the generated ffmpeg command
  ffmpegName: string;
  bitDepth: number;
}

export interface PipelineStep {
  // environment variables
  globalOptions(): string[];
  filterOptions(): string[];
  outputOptions(): string[];
  inputOptions(inputFile: InputFile): string[];
  nextState(currentState: FrameState): FrameState;
}

export interface InputOption extends PipelineStep {
  //
  appliesToInput(input: InputFile): boolean;
}

export class FrameSize {
  constructor(
    public width: number,
    public height: number,
  ) {}

  equals({ width: otherWidth, height: otherHeight }: FrameSize) {
    return this.width === otherWidth && this.height === otherHeight;
  }
}

export abstract class InputFile {
  inputOptions: InputOption[];
  filterSteps: PipelineFilterStep[];
}

export class AudioInputFile extends InputFile {
  constructor(
    public path: string,
    public audioStreams: AudioStream[],
    public desiredState: AudioState,
  ) {
    super();
  }
}

export class VideoInputFile extends InputFile {
  constructor(
    public path: string,
    public videoStreams: VideoStream[],
  ) {
    super();
  }
}
