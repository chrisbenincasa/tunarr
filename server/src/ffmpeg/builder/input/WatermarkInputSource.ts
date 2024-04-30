import { Watermark } from '@tunarr/types';
import { StillImageStream } from '../MediaStream.ts';
import { StreamSource } from './InputSource.ts';
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
