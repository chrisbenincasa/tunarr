import type { VideoStream } from '@/ffmpeg/builder/MediaStream.js';
import type { Watermark } from '@tunarr/types';
import type { StreamSource } from './InputSource.ts';
import { VideoInputSource } from './VideoInputSource.ts';

export class WatermarkInputSource extends VideoInputSource<VideoStream> {
  constructor(
    source: StreamSource,
    imageStream: VideoStream,
    public watermark: Watermark,
  ) {
    super(source, [imageStream]);
  }
}
