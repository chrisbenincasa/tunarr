import { VideoStream } from '@/ffmpeg/builder/MediaStream.js';
import { FrameSize } from '@/ffmpeg/builder/types.js';
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
        sampleAspectRatio: null,
        displayAspectRatio: '1:1',
        inputKind: 'video',
      }),
    ];
  }
}
