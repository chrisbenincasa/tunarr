import { ScaleVaapiFilter } from '@/ffmpeg/builder/filter/vaapi/ScaleVaapiFilter.js';
import {
  PixelFormatNv12,
  PixelFormatP010,
  PixelFormatYuv420P,
  PixelFormatYuv420P10Le,
} from '@/ffmpeg/builder/format/PixelFormat.js';
import { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import { FrameDataLocation, FrameSize } from '@/ffmpeg/builder/types.js';

describe('ScaleVaapiFilter', () => {
  test('format only, 8-bit, on hardware', () => {
    const currentState = new FrameState({
      scaledSize: FrameSize.FHD,
      paddedSize: FrameSize.FHD,
      isAnamorphic: false,
      pixelFormat: new PixelFormatYuv420P(),
      frameDataLocation: FrameDataLocation.Hardware,
    });

    const filter = new ScaleVaapiFilter(
      currentState,
      FrameSize.FHD,
      FrameSize.FHD,
    );

    expect(filter.filter).toEqual('scale_vaapi=format=nv12:extra_hw_frames=64');
    expect(filter.nextState(currentState).pixelFormat).toMatchPixelFormat(
      new PixelFormatNv12(new PixelFormatYuv420P()),
    );
  });

  test('format only, 8-bit, on software', () => {
    const currentState = new FrameState({
      scaledSize: FrameSize.FHD,
      paddedSize: FrameSize.FHD,
      isAnamorphic: false,
      pixelFormat: new PixelFormatYuv420P(),
      frameDataLocation: FrameDataLocation.Software,
    });

    const filter = new ScaleVaapiFilter(
      currentState,
      FrameSize.FHD,
      FrameSize.FHD,
    );

    expect(filter.filter).toEqual(
      'format=nv12|p010le|vaapi,hwupload=extra_hw_frames=64,scale_vaapi=format=nv12:extra_hw_frames=64',
    );
    expect(filter.nextState(currentState).pixelFormat).toMatchPixelFormat(
      new PixelFormatNv12(new PixelFormatYuv420P()),
    );
    expect(filter.nextState(currentState).frameDataLocation).toEqual(
      FrameDataLocation.Hardware,
    );
  });

  test('format only, 10-bit, on hardware', () => {
    const currentState = new FrameState({
      scaledSize: FrameSize.FHD,
      paddedSize: FrameSize.FHD,
      isAnamorphic: false,
      pixelFormat: new PixelFormatYuv420P10Le(),
      frameDataLocation: FrameDataLocation.Hardware,
    });

    const filter = new ScaleVaapiFilter(
      currentState,
      FrameSize.FHD,
      FrameSize.FHD,
    );

    expect(filter.filter).toEqual(
      'scale_vaapi=format=p010le:extra_hw_frames=64',
    );
    expect(filter.nextState(currentState).pixelFormat).toMatchPixelFormat(
      new PixelFormatP010(),
    );
  });
});
