import { ScaleVaapiFilter } from '@/ffmpeg/builder/filter/vaapi/ScaleVaapiFilter.ts';
import {
  PixelFormatNv12,
  PixelFormatP010,
  PixelFormatYuv420P,
  PixelFormatYuv420P10Le,
} from '@/ffmpeg/builder/format/PixelFormat.ts';
import { FrameState } from '@/ffmpeg/builder/state/FrameState.ts';
import { FrameDataLocation, FrameSize } from '@/ffmpeg/builder/types.ts';

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

    expect(filter.filter).to.eq('scale_vaapi=format=nv12:extra_hw_frames=64');
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

    expect(filter.filter).to.eq(
      'format=nv12|p010|vaapi,hwupload=extra_hw_frames=64,scale_vaapi=format=nv12:extra_hw_frames=64',
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

    expect(filter.filter).to.eq('scale_vaapi=format=p010:extra_hw_frames=64');
    expect(filter.nextState(currentState).pixelFormat).toMatchPixelFormat(
      new PixelFormatP010(),
    );
  });
});
