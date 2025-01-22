import type { StillImageStream } from '@/ffmpeg/builder/MediaStream.js';
import type { Watermark } from '@tunarr/types';
import type { StreamSource } from './InputSource.ts';
import { VideoInputSource } from './VideoInputSource.ts';

export class WatermarkInputSource extends VideoInputSource<StillImageStream> {
  constructor(
    source: StreamSource,
    imageStream: StillImageStream,
    public watermark: Watermark,
  ) {
    super(source, [imageStream]);
  }
}
