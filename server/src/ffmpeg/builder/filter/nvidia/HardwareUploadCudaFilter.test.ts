import {
  PixelFormatCuda,
  PixelFormatYuv420P,
} from '../../format/PixelFormat.ts';
import { FrameState } from '../../state/FrameState.ts';
import { FrameDataLocation } from '../../types.ts';
import { HardwareUploadCudaFilter } from './HardwareUploadCudaFilter.ts';

describe('HardwareUploadCudaFilter', () => {
  test('does nothing when already on hardware', () => {
    const state = new FrameState({
      frameDataLocation: FrameDataLocation.Hardware,
    } as FrameState);
    const filter = new HardwareUploadCudaFilter(state);
    expect(filter.filter).to.be.empty;
    expect(filter.nextState(state)).toBe(state);
  });

  test('uploads and changes pixel format to CUDA', () => {
    const state = new FrameState({
      frameDataLocation: FrameDataLocation.Software,
      pixelFormat: new PixelFormatYuv420P(),
    } as FrameState);
    const filter = new HardwareUploadCudaFilter(state);
    expect(filter.filter).toEqual('hwupload_cuda');
    expect(filter.nextState(state)).toMatchObject({
      frameDataLocation: FrameDataLocation.Hardware,
      pixelFormat: new PixelFormatCuda(new PixelFormatYuv420P()),
    });
  });
});
