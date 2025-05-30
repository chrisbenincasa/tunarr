import type { VideoStream } from '@/ffmpeg/builder/MediaStream.js';
import { FrameDataLocation } from '../types.ts';
import type { InputSourceContinuity, StreamSource } from './InputSource.ts';
import { InputSource } from './InputSource.ts';

export class VideoInputSource<
  StreamType extends VideoStream = VideoStream,
> extends InputSource<StreamType> {
  #frameDataLocation: FrameDataLocation = FrameDataLocation.Unknown;
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

  get frameDataLocation() {
    return this.#frameDataLocation;
  }

  set frameDataLocation(location: FrameDataLocation) {
    this.#frameDataLocation = location;
  }
}
