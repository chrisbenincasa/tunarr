import {
  ColorRanges,
  ColorTransferFormats,
} from '@/ffmpeg/builder/constants.js';
import { TonemapOpenclFilter } from '@/ffmpeg/builder/filter/opencl/TonemapOpenclFilter.js';
import {
  PixelFormatNv12,
  PixelFormatUnknown,
  PixelFormatVaapi,
  PixelFormatYuv420P,
  PixelFormatYuv420P10Le,
} from '@/ffmpeg/builder/format/PixelFormat.js';
import { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import { FrameDataLocation, FrameSize } from '@/ffmpeg/builder/types.js';

describe('TonemapOpenclFilter', () => {
  test('filter string when frame data is on hardware', () => {
    const currentState = new FrameState({
      scaledSize: FrameSize.FHD,
      paddedSize: FrameSize.FHD,
      isAnamorphic: false,
      pixelFormat: new PixelFormatYuv420P10Le(),
      frameDataLocation: FrameDataLocation.Hardware,
    });

    const filter = new TonemapOpenclFilter(currentState);

    expect(filter.filter).to.eq(
      'hwmap=derive_device=opencl,tonemap_opencl=tonemap=hable:desat=0:t=bt709:m=bt709:p=bt709:format=nv12,hwmap=derive_device=vaapi:reverse=1',
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

    const filter = new TonemapOpenclFilter(currentState);

    expect(filter.filter).to.eq(
      'format=vaapi|nv12|p010le,hwmap=derive_device=opencl,tonemap_opencl=tonemap=hable:desat=0:t=bt709:m=bt709:p=bt709:format=nv12,hwmap=derive_device=vaapi:reverse=1',
    );
  });

  test('affectsFrameState is true', () => {
    const currentState = new FrameState({
      scaledSize: FrameSize.FHD,
      paddedSize: FrameSize.FHD,
      isAnamorphic: false,
      frameDataLocation: FrameDataLocation.Hardware,
    });

    const filter = new TonemapOpenclFilter(currentState);

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

    const filter = new TonemapOpenclFilter(currentState);
    const nextState = filter.nextState(currentState);

    expect(nextState.colorFormat?.colorSpace).to.eq(ColorTransferFormats.Bt709);
    expect(nextState.colorFormat?.colorTransfer).to.eq(
      ColorTransferFormats.Bt709,
    );
    expect(nextState.colorFormat?.colorPrimaries).to.eq(
      ColorTransferFormats.Bt709,
    );
    expect(nextState.colorFormat?.colorRange).to.eq(ColorRanges.Tv);
  });

  test('nextState sets frame data location to hardware', () => {
    const currentState = new FrameState({
      scaledSize: FrameSize.FHD,
      paddedSize: FrameSize.FHD,
      isAnamorphic: false,
      pixelFormat: new PixelFormatYuv420P(),
      frameDataLocation: FrameDataLocation.Software,
    });

    const filter = new TonemapOpenclFilter(currentState);
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

    const filter = new TonemapOpenclFilter(currentState);
    const nextState = filter.nextState(currentState);

    expect(nextState.pixelFormat).toMatchPixelFormat(
      new PixelFormatNv12(new PixelFormatYuv420P10Le()),
    );
  });

  test('nextState wraps unknown pixel format in PixelFormatNv12 when no current pixel format', () => {
    const currentState = new FrameState({
      scaledSize: FrameSize.FHD,
      paddedSize: FrameSize.FHD,
      isAnamorphic: false,
      frameDataLocation: FrameDataLocation.Hardware,
    });

    const filter = new TonemapOpenclFilter(currentState);
    const nextState = filter.nextState(currentState);

    expect(nextState.pixelFormat).toMatchPixelFormat(
      new PixelFormatNv12(PixelFormatUnknown()),
    );
  });

  test('nextState does not double-wrap nv12 pixel format in another nv12', () => {
    const currentState = new FrameState({
      scaledSize: FrameSize.FHD,
      paddedSize: FrameSize.FHD,
      isAnamorphic: false,
      pixelFormat: new PixelFormatNv12(new PixelFormatYuv420P()),
      frameDataLocation: FrameDataLocation.Hardware,
    });

    const filter = new TonemapOpenclFilter(currentState);
    const nextState = filter.nextState(currentState);

    expect(nextState.pixelFormat).toMatchPixelFormat(
      new PixelFormatNv12(new PixelFormatYuv420P()),
    );
  });

  test('nextState does not wrap vaapi pixel format in nv12 without unwrapping', () => {
    const currentState = new FrameState({
      scaledSize: FrameSize.FHD,
      paddedSize: FrameSize.FHD,
      isAnamorphic: false,
      pixelFormat: new PixelFormatVaapi(new PixelFormatYuv420P()),
      frameDataLocation: FrameDataLocation.Hardware,
    });

    const filter = new TonemapOpenclFilter(currentState);
    const nextState = filter.nextState(currentState);

    expect(nextState.pixelFormat).toMatchPixelFormat(
      new PixelFormatNv12(new PixelFormatYuv420P()),
    );
  });
});
