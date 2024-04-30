import { isNull } from 'lodash-es';
import { Nullable } from '../../types/util';
import { FrameSize, PixelFormat, StreamKind } from './types';

export type MediaStream = {
  index: number;
  codec: string;
  kind: StreamKind;
};

export type AudioStream = MediaStream & {
  kind: 'audio';
  channels: number;
};

export function AudioStream(fields: Omit<AudioStream, 'kind'>): AudioStream {
  return {
    ...fields,
    kind: 'audio',
  };
}

export class VideoStream implements MediaStream {
  public readonly kind: StreamKind = 'video';

  constructor(
    public index: number,
    public codec: string,
    public pixelFormat: Nullable<PixelFormat>,
    public frameSize: FrameSize,
    public isAnamorphic: boolean,
    public pixelAspectRatio: Nullable<`${number}:${number}`>,
  ) {}

  squarePixelFrameSize(resolution: FrameSize): FrameSize {
    let width = this.frameSize.width;
    let height = this.frameSize.height;

    if (this.isAnamorphic && !isNull(this.pixelAspectRatio)) {
      const [numStr, denStr] = this.pixelAspectRatio.split(':');
      const num = Number.parseFloat(numStr);
      const den = Number.parseFloat(denStr);

      width = Math.floor((this.frameSize.width * num) / den);
      height = Math.floor((this.frameSize.height * num) / den);
    }

    const widthPercent = resolution.width / width;
    const heightPercent = resolution.height / height;
    const minPercent = Math.min(widthPercent, heightPercent);

    return new FrameSize(
      Math.floor(width * minPercent),
      Math.floor(height * minPercent),
    );
  }
}
