import {
  PixelFormatCuda,
  PixelFormatNv12,
  PixelFormatYuv420P,
  PixelFormatYuv444P,
} from '../../format/PixelFormat.ts';
import { FrameState } from '../../state/FrameState.ts';
import { FrameDataLocation, FrameSize } from '../../types.ts';
import { HardwareDownloadCudaFilter } from './HardwareDownloadCudaFilter.ts';

describe('HardwareDownloadCudaFilter', () => {
  test('empty if current frame is not on hardware', () => {
    const currentState = new FrameState({
      isAnamorphic: false,
      paddedSize: FrameSize.withDimensions(1920, 1080),
      scaledSize: FrameSize.withDimensions(1920, 1080),
      frameDataLocation: FrameDataLocation.Software,
    });
    const filter = new HardwareDownloadCudaFilter(currentState, null);

    expect(filter.filter).to.eq('');

    const nextState = filter.nextState(currentState);
    expect(nextState).toBe(currentState);
  });

  test('currentFormat=null', () => {
    const currentState = new FrameState({
      isAnamorphic: false,
      paddedSize: FrameSize.withDimensions(1920, 1080),
      scaledSize: FrameSize.withDimensions(1920, 1080),
      frameDataLocation: FrameDataLocation.Hardware,
    });
    const filter = new HardwareDownloadCudaFilter(currentState, null);

    expect(filter.filter).to.eq('hwdownload');

    const nextState = filter.nextState(currentState);
    expect(nextState).toMatchObject({
      frameDataLocation: FrameDataLocation.Software,
    });

    // Does not mutate
    expect(nextState).not.toBe(currentState);
  });

  test('currentFormat=nv12', () => {
    const underlyingPixelFormat = new PixelFormatYuv420P();
    const currentState = new FrameState({
      isAnamorphic: false,
      paddedSize: FrameSize.withDimensions(1920, 1080),
      scaledSize: FrameSize.withDimensions(1920, 1080),
      frameDataLocation: FrameDataLocation.Hardware,
      pixelFormat: new PixelFormatNv12(underlyingPixelFormat),
    });

    const filter = new HardwareDownloadCudaFilter(currentState, null);

    expect(filter.filter).to.eq('hwdownload,format=nv12,format=yuv420p');

    const nextState = filter.nextState(currentState);
    expect(nextState).toMatchObject({
      frameDataLocation: FrameDataLocation.Software,
      pixelFormat: underlyingPixelFormat,
    });

    // Does not mutate
    expect(nextState).not.toBe(currentState);
  });

  test('currentFormat=nv12 targetFormat=yuv444p', () => {
    const underlyingPixelFormat = new PixelFormatYuv420P();
    const targetFormat = new PixelFormatYuv444P();
    const currentState = new FrameState({
      isAnamorphic: false,
      paddedSize: FrameSize.withDimensions(1920, 1080),
      scaledSize: FrameSize.withDimensions(1920, 1080),
      frameDataLocation: FrameDataLocation.Hardware,
      pixelFormat: new PixelFormatNv12(underlyingPixelFormat),
    });

    const filter = new HardwareDownloadCudaFilter(currentState, targetFormat);

    expect(filter.filter).to.eq('hwdownload,format=nv12,format=yuv444p');

    const nextState = filter.nextState(currentState);
    expect(nextState).toMatchObject({
      frameDataLocation: FrameDataLocation.Software,
      pixelFormat: targetFormat,
    });

    // Does not mutate
    expect(nextState).not.toBe(currentState);
  });

  test('currentFormat=cuda+yuv420p targetFormat=yuv420p', () => {
    const targetFormat = new PixelFormatYuv420P();
    const currentState = new FrameState({
      isAnamorphic: false,
      paddedSize: FrameSize.FHD,
      scaledSize: FrameSize.FHD,
      frameDataLocation: FrameDataLocation.Hardware,
      pixelFormat: new PixelFormatCuda(targetFormat),
    });

    const filter = new HardwareDownloadCudaFilter(currentState, targetFormat);

    expect(filter.filter).to.eq('hwdownload,format=yuv420p');

    const nextState = filter.nextState(currentState);
    expect(nextState).toMatchObject({
      frameDataLocation: FrameDataLocation.Software,
      pixelFormat: targetFormat,
    });

    // Does not mutate
    expect(nextState).not.toBe(currentState);
  });

  test('currentFormat=cuda+nv12 targetFormat=yuv420p', () => {
    const targetFormat = new PixelFormatYuv420P();
    const currentState = new FrameState({
      isAnamorphic: false,
      paddedSize: FrameSize.FHD,
      scaledSize: FrameSize.FHD,
      frameDataLocation: FrameDataLocation.Hardware,
      pixelFormat: new PixelFormatCuda(
        new PixelFormatNv12(new PixelFormatYuv420P()),
      ),
    });

    const filter = new HardwareDownloadCudaFilter(currentState, targetFormat);

    expect(filter.filter).to.eq('hwdownload,format=nv12,format=yuv420p');

    const nextState = filter.nextState(currentState);
    expect(nextState).toMatchObject({
      frameDataLocation: FrameDataLocation.Software,
      pixelFormat: targetFormat,
    });

    // Does not mutate
    expect(nextState).not.toBe(currentState);
  });
});
