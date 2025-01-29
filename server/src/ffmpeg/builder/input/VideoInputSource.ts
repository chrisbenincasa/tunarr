import type { VideoStream } from '@/ffmpeg/builder/MediaStream.js';
import type { InputSourceContinuity, StreamSource } from './InputSource.ts';
import { InputSource } from './InputSource.ts';

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
