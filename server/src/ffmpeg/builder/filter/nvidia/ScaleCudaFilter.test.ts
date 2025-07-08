import { ScaleCudaFilter } from '@/ffmpeg/builder/filter/nvidia/ScaleCudaFilter.js';
import {
  PixelFormatP010,
  PixelFormatYuv420P,
  PixelFormatYuv420P10Le,
} from '@/ffmpeg/builder/format/PixelFormat.js';
import { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import { FrameDataLocation, FrameSize } from '@/ffmpeg/builder/types.js';

describe('ScaleCudaFilter', () => {
  test('format only, 8-bit, on hardware', () => {
    const currentState = new FrameState({
      isAnamorphic: false,
      paddedSize: FrameSize.withDimensions(1920, 1080),
      scaledSize: FrameSize.withDimensions(1920, 1080),
      frameDataLocation: FrameDataLocation.Hardware,
      pixelFormat: new PixelFormatYuv420P(),
    });

    // sizes are equal
    const filter = new ScaleCudaFilter(
      currentState,
      currentState.scaledSize,
      currentState.paddedSize,
    );

    expect(filter.filter).to.eq('scale_cuda=format=yuv420p');
    expect(filter.nextState(currentState).pixelFormat).toMatchPixelFormat(
      new PixelFormatYuv420P(),
    );
  });

  test('format only, 10-bit, on hardware', () => {
    const currentState = new FrameState({
      isAnamorphic: false,
      paddedSize: FrameSize.withDimensions(1920, 1080),
      scaledSize: FrameSize.withDimensions(1920, 1080),
      frameDataLocation: FrameDataLocation.Hardware,
      pixelFormat: new PixelFormatYuv420P10Le(),
    });

    // sizes are equal
    const filter = new ScaleCudaFilter(
      currentState,
      currentState.scaledSize,
      currentState.paddedSize,
    );

    expect(filter.filter).to.eq('scale_cuda=format=p010le');
    expect(filter.nextState(currentState).pixelFormat).toMatchPixelFormat(
      new PixelFormatP010(),
    );
  });

  test('format only, 10-bit, passthrough', () => {
    const currentState = new FrameState({
      isAnamorphic: false,
      paddedSize: FrameSize.withDimensions(1920, 1080),
      scaledSize: FrameSize.withDimensions(1920, 1080),
      frameDataLocation: FrameDataLocation.Hardware,
      pixelFormat: new PixelFormatYuv420P10Le(),
    });

    // sizes are equal
    const filter = ScaleCudaFilter.formatOnly(
      currentState,
      new PixelFormatP010(),
      true,
    );

    expect(filter.filter).to.eq('scale_cuda=format=p010le:passthrough=1');
    expect(filter.nextState(currentState).pixelFormat).toMatchPixelFormat(
      new PixelFormatP010(),
    );
  });
});
