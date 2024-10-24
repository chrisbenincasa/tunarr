import { Watermark } from '@tunarr/types';
import { flatMap } from 'lodash-es';
import { AnyFunction } from 'ts-essentials';
import { ExcludeByValueType, TupleToUnion } from '../../types/util';
import { AudioStream, StillImageStream, VideoStream } from './MediaStream';
import { PipelineFilterStep } from './filter/PipelineFilterStep';
import { InputOption } from './options/InputOption';
import { AudioState } from './state/AudioState';
import { FrameState } from './state/FrameState';

export type DataProps<T> = ExcludeByValueType<T, AnyFunction>;

export const HardwareAccelerationModes = [
  'none',
  'qsv',
  'cuda',
  'vaapi',
  'videotoolbox',
  // 'amf',
] as const;

export type HardwareAccelerationMode = TupleToUnion<
  typeof HardwareAccelerationModes
>;

export const StreamKinds = ['audio', 'video', 'all', 'stillimage'] as const;

export type StreamKind = TupleToUnion<typeof StreamKinds>;

export const FrameDataLocations = ['unknown', 'hardware', 'software'] as const;

export type FrameDataLocation = TupleToUnion<typeof FrameDataLocations>;

export type PipelineStepType = 'global' | 'filter' | 'output' | 'input';
export interface PipelineStep<Requirements extends unknown[] = []> {
  type: PipelineStepType;
  options(...reqs: Requirements): string[];
}

export interface FrameStateUpdater {
  affectsFrameState: boolean;
  nextState(currentState: FrameState): FrameState;
}

export interface EnvironmentVariablePipelineStep extends PipelineStep {}

type FrameSizeFields = DataProps<FrameSize>;

export class FrameSize {
  width: number;
  height: number;

  private constructor(fields: FrameSizeFields) {
    this.width = fields.width;
    this.height = fields.height;
  }

  static create(fields: FrameSizeFields) {
    return new FrameSize(fields);
  }

  // Prefer create above
  static withDimensions(width: number, height: number) {
    return this.create({ width, height });
  }

  equals({ width: otherWidth, height: otherHeight }: FrameSize) {
    return this.width === otherWidth && this.height === otherHeight;
  }
}

export abstract class InputSource {
  type: 'video' | 'audio';
  inputOptions: InputOption[] = [];
  filterSteps: PipelineFilterStep[] = [];

  addOption(option: InputOption) {
    if (option.appliesToInput(this)) {
      this.inputOptions.push(option);
    }
  }

  // This isn't ideal since it means the parent
  // class knows of its children... we can find a
  // better way. it's also technically not true
  // since something else could extend this and
  // set their type to video
  isVideo(): this is VideoInputSource {
    return this.type === 'video';
  }

  getInputOptions() {
    return flatMap(this.inputOptions, (opt) => opt.options(this));
  }
}

export class AudioInputSource extends InputSource {
  readonly type = 'audio';
  constructor(
    public path: string,
    public audioStreams: AudioStream[],
    public desiredState: AudioState,
  ) {
    super();
  }
}

export class VideoInputSource<
  Streams extends VideoStream[] = VideoStream[],
> extends InputSource {
  readonly type = 'video';
  constructor(
    public path: string,
    public videoStreams: Streams,
  ) {
    super();
  }
}

export class NonEmptyVideoInputSource extends VideoInputSource<
  [VideoStream, ...VideoStream[]]
> {}

export class WatermarkInputSource extends VideoInputSource<[StillImageStream]> {
  constructor(
    path: string,
    imageStream: StillImageStream,
    public watermark: Watermark,
  ) {
    super(path, [imageStream]);
  }
}
