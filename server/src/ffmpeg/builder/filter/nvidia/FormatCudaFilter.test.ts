import {
  PixelFormatP010,
  PixelFormatYuv420P,
  PixelFormatYuv420P10Le,
} from '../../format/PixelFormat.ts';
import { FrameState } from '../../state/FrameState.ts';
import { FrameDataLocation, FrameSize } from '../../types.ts';
import { FormatCudaFilter } from './FormatCudaFilter.ts';

const BaseCurrentState = new FrameState({
  isAnamorphic: false,
  paddedSize: FrameSize.withDimensions(1920, 1080),
  scaledSize: FrameSize.withDimensions(1920, 1080),
  frameDataLocation: FrameDataLocation.Hardware,
});

describe('FormatCudaFilter', () => {
  test('format=yuv420p', () => {
    const filter = new FormatCudaFilter(new PixelFormatYuv420P());

    expect(filter.filter).to.eq(`scale_cuda=format=yuv420p`);
    expect(filter.nextState(BaseCurrentState).pixelFormat).toMatchPixelFormat(
      new PixelFormatYuv420P(),
    );
  });

  test('unsupported format with hardware', () => {
    const filter = new FormatCudaFilter(new PixelFormatYuv420P10Le());

    expect(filter.filter).to.eq('scale_cuda=format=p010le');
    expect(filter.nextState(BaseCurrentState).pixelFormat).toMatchPixelFormat(
      new PixelFormatP010(),
    );
  });
});
