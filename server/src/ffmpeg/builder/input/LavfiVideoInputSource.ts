import { VideoStream } from '@/ffmpeg/builder/MediaStream.ts';
import { StaticFilter } from '@/ffmpeg/builder/filter/StaticFilter.ts';
import { TitleTextFilter } from '@/ffmpeg/builder/filter/TitleTextFilter.ts';
import { PixelFormatUnknown } from '@/ffmpeg/builder/format/PixelFormat.ts';
import { LavfiInputOption } from '@/ffmpeg/builder/options/input/LavfiInputOption.ts';
import { FrameSize } from '@/ffmpeg/builder/types.ts';
import { HasFilterOption } from '@/ffmpeg/builder/types/PipelineStep.ts';
import { FilterStreamSource } from '@/stream/types.ts';
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
        isAnamorphic: false,
        index: 0,
        inputKind: 'filter',
        pixelAspectRatio: null,
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
