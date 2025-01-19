import { VideoStream } from '@/ffmpeg/builder/MediaStream.js';
import {
  InputSource,
  InputSourceContinuity,
  StreamSource,
} from './InputSource.ts';

export class VideoInputSource<
  StreamType extends VideoStream = VideoStream,
> extends InputSource<StreamType> {
  readonly type = 'video';

  constructor(
    source: StreamSource,
    public streams: StreamType[],
    continuity: InputSourceContinuity = 'discrete',
  ) {
    super(source, continuity);
  }

  static withStream(
    source: StreamSource,
    videoStream: VideoStream,
  ): VideoInputSource {
    return new VideoInputSource(source, [videoStream]);
  }
}
