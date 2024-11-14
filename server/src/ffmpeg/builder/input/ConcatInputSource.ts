import { VideoStream } from '../MediaStream.ts';
import { FrameSize } from '../types.ts';
import {
  InputSource,
  InputSourceContinuity,
  InputSourceType,
  StreamSource,
} from './InputSource.ts';

export class ConcatInputSource extends InputSource<VideoStream> {
  readonly type: InputSourceType = 'video';

  constructor(
    source: StreamSource,
    private frameSize: FrameSize,
    continuity: InputSourceContinuity = 'infinite',
  ) {
    super(source, continuity);
  }

  get streams(): VideoStream[] {
    return [
      VideoStream.create({
        index: 0,
        codec: '',
        profile: '',
        pixelFormat: null,
        frameSize: this.frameSize,
        isAnamorphic: false,
        pixelAspectRatio: null,
        inputKind: 'video',
      }),
    ];
  }
}
