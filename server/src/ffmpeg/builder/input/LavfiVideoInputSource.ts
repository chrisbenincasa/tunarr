import { VideoStream } from '@/ffmpeg/builder/MediaStream.js';
import { StaticFilter } from '@/ffmpeg/builder/filter/StaticFilter.js';
import { TitleTextFilter } from '@/ffmpeg/builder/filter/TitleTextFilter.js';
import { PixelFormatUnknown } from '@/ffmpeg/builder/format/PixelFormat.js';
import { LavfiInputOption } from '@/ffmpeg/builder/options/input/LavfiInputOption.js';
import { FrameSize } from '@/ffmpeg/builder/types.js';
import type { HasFilterOption } from '@/ffmpeg/builder/types/PipelineStep.js';
import { FilterStreamSource } from '@/stream/types.js';
import { VideoInputSource } from './VideoInputSource.ts';

export class LavfiVideoInputSource extends VideoInputSource {
  private constructor(
    src: FilterStreamSource,
    size: FrameSize,
    public filterSteps: HasFilterOption[],
  ) {
    super(src, [
      VideoStream.create({
        codec: 'generated',
        pixelFormat: PixelFormatUnknown(),
        index: 0,
        inputKind: 'filter',
        providedSampleAspectRatio: null,
        displayAspectRatio: '1:1',
        frameSize: size,
      }),
    ]);
    this.addOption(new LavfiInputOption());
  }

  static createStatic(
    size: FrameSize = FrameSize.create({ width: 480, height: 270 }),
  ) {
    return new LavfiVideoInputSource(
      new FilterStreamSource(`nullsrc=s=${size.width}x${size.height}`),
      size,
      [new StaticFilter()],
    );
  }

  static testSource(size: FrameSize) {
    return new LavfiVideoInputSource(
      new FilterStreamSource(`testsrc=size=${size.width}x${size.height}`),
      size,
      [],
    );
  }

  static errorText(size: FrameSize, title: string, subtitle?: string) {
    return new LavfiVideoInputSource(
      new FilterStreamSource(`color=c=black:s=${size.width}x${size.height}`),
      size,
      [new TitleTextFilter(size, title, subtitle)],
    );
  }
}
