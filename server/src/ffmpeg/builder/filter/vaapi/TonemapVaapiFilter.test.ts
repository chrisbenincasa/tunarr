import { TonemapVaapiFilter } from '@/ffmpeg/builder/filter/vaapi/TonemapVaapiFilter.js';
import { ColorTransferFormats } from '@/ffmpeg/builder/constants.js';
import {
  PixelFormatNv12,
  PixelFormatYuv420P,
  PixelFormatYuv420P10Le,
} from '@/ffmpeg/builder/format/PixelFormat.js';
import { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import { FrameDataLocation, FrameSize } from '@/ffmpeg/builder/types.js';

describe('TonemapVaapiFilter', () => {
  test('filter string when frame data is on hardware', () => {
    const currentState = new FrameState({
      scaledSize: FrameSize.FHD,
      paddedSize: FrameSize.FHD,
      isAnamorphic: false,
      pixelFormat: new PixelFormatYuv420P10Le(),
      frameDataLocation: FrameDataLocation.Hardware,
    });

    const filter = new TonemapVaapiFilter(currentState);

    expect(filter.filter).to.eq(
      'tonemap_vaapi=format=nv12:t=bt709:m=bt709:p=bt709',
    );
  });

  test('filter string when frame data is in software', () => {
    const currentState = new FrameState({
      scaledSize: FrameSize.FHD,
      paddedSize: FrameSize.FHD,
      isAnamorphic: false,
      pixelFormat: new PixelFormatYuv420P10Le(),
      frameDataLocation: FrameDataLocation.Software,
    });

    const filter = new TonemapVaapiFilter(currentState);

    expect(filter.filter).to.eq(
      'format=vaapi|nv12|p010le,tonemap_vaapi=format=nv12:t=bt709:m=bt709:p=bt709',
    );
  });

  test('affectsFrameState is true', () => {
    const currentState = new FrameState({
      scaledSize: FrameSize.FHD,
      paddedSize: FrameSize.FHD,
      isAnamorphic: false,
      frameDataLocation: FrameDataLocation.Hardware,
    });

    const filter = new TonemapVaapiFilter(currentState);

    expect(filter.affectsFrameState).toBe(true);
  });

  test('nextState sets color properties to bt709 and tv range', () => {
    const currentState = new FrameState({
      scaledSize: FrameSize.FHD,
      paddedSize: FrameSize.FHD,
      isAnamorphic: false,
      pixelFormat: new PixelFormatYuv420P10Le(),
      frameDataLocation: FrameDataLocation.Hardware,
    });

    const filter = new TonemapVaapiFilter(currentState);
    const nextState = filter.nextState(currentState);

    expect(nextState.colorSpace).to.eq(ColorTransferFormats.Bt709);
    expect(nextState.colorTransfer).to.eq(ColorTransferFormats.Bt709);
    expect(nextState.colorPrimaries).to.eq(ColorTransferFormats.Bt709);
    expect(nextState.colorRange).to.eq(ColorTransferFormats.Tv);
  });

  test('nextState sets frame data location to hardware', () => {
    const currentState = new FrameState({
      scaledSize: FrameSize.FHD,
      paddedSize: FrameSize.FHD,
      isAnamorphic: false,
      pixelFormat: new PixelFormatYuv420P(),
      frameDataLocation: FrameDataLocation.Software,
    });

    const filter = new TonemapVaapiFilter(currentState);
    const nextState = filter.nextState(currentState);

    expect(nextState.frameDataLocation).to.eq(FrameDataLocation.Hardware);
  });

  test('nextState wraps existing pixel format in PixelFormatNv12', () => {
    const currentState = new FrameState({
      scaledSize: FrameSize.FHD,
      paddedSize: FrameSize.FHD,
      isAnamorphic: false,
      pixelFormat: new PixelFormatYuv420P10Le(),
      frameDataLocation: FrameDataLocation.Hardware,
    });

    const filter = new TonemapVaapiFilter(currentState);
    const nextState = filter.nextState(currentState);

    expect(nextState.pixelFormat).toMatchPixelFormat(
      new PixelFormatNv12(new PixelFormatYuv420P10Le()),
    );
  });

  test('nextState sets pixel format to null when no current pixel format', () => {
    const currentState = new FrameState({
      scaledSize: FrameSize.FHD,
      paddedSize: FrameSize.FHD,
      isAnamorphic: false,
      frameDataLocation: FrameDataLocation.Hardware,
    });

    const filter = new TonemapVaapiFilter(currentState);
    const nextState = filter.nextState(currentState);

    expect(nextState.pixelFormat).toBeNull();
  });
});
