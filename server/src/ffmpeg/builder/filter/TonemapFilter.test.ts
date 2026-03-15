import {
  ColorPrimaries,
  ColorRanges,
  ColorSpaces,
  ColorTransferFormats,
} from '@/ffmpeg/builder/constants.js';
import { TonemapFilter } from '@/ffmpeg/builder/filter/TonemapFilter.js';
import { ColorFormat } from '@/ffmpeg/builder/format/ColorFormat.js';
import {
  PixelFormatYuv420P,
  PixelFormatYuv420P10Le,
} from '@/ffmpeg/builder/format/PixelFormat.js';
import { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import { FrameDataLocation, FrameSize } from '@/ffmpeg/builder/types.js';

describe('TonemapFilter', () => {
  test('filter string when frame data is in software (no hwdownload prefix)', () => {
    const currentState = new FrameState({
      scaledSize: FrameSize.FHD,
      paddedSize: FrameSize.FHD,
      isAnamorphic: false,
      pixelFormat: new PixelFormatYuv420P10Le(),
      frameDataLocation: FrameDataLocation.Software,
    });

    const filter = new TonemapFilter(currentState);

    expect(filter.filter).to.eq(
      'zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,' +
        'tonemap=tonemap=hable:desat=0,' +
        'zscale=t=bt709:m=bt709:r=tv,format=yuv420p',
    );
  });

  test('filter string when frame data is on hardware (hwdownload prefix present)', () => {
    const currentState = new FrameState({
      scaledSize: FrameSize.FHD,
      paddedSize: FrameSize.FHD,
      isAnamorphic: false,
      pixelFormat: new PixelFormatYuv420P10Le(),
      frameDataLocation: FrameDataLocation.Hardware,
    });

    const filter = new TonemapFilter(currentState);

    expect(filter.filter).to.eq(
      'hwdownload,format=p010le|nv12,' +
        'zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,' +
        'tonemap=tonemap=hable:desat=0,' +
        'zscale=t=bt709:m=bt709:r=tv,format=yuv420p',
    );
  });

  test('affectsFrameState is true', () => {
    const currentState = new FrameState({
      scaledSize: FrameSize.FHD,
      paddedSize: FrameSize.FHD,
      isAnamorphic: false,
      frameDataLocation: FrameDataLocation.Software,
    });

    const filter = new TonemapFilter(currentState);

    expect(filter.affectsFrameState).toBe(true);
  });

  test('nextState sets colorFormat to bt709', () => {
    const currentState = new FrameState({
      scaledSize: FrameSize.FHD,
      paddedSize: FrameSize.FHD,
      isAnamorphic: false,
      pixelFormat: new PixelFormatYuv420P10Le(),
      frameDataLocation: FrameDataLocation.Software,
    });

    const filter = new TonemapFilter(currentState);
    const nextState = filter.nextState(currentState);

    expect(nextState.colorFormat?.colorSpace).to.eq(ColorSpaces.Bt709);
    expect(nextState.colorFormat?.colorTransfer).to.eq(
      ColorTransferFormats.Bt709,
    );
    expect(nextState.colorFormat?.colorPrimaries).to.eq(ColorPrimaries.Bt709);
    expect(nextState.colorFormat?.colorRange).to.eq(ColorRanges.Tv);
  });

  test('nextState sets frameDataLocation to Software', () => {
    const currentState = new FrameState({
      scaledSize: FrameSize.FHD,
      paddedSize: FrameSize.FHD,
      isAnamorphic: false,
      pixelFormat: new PixelFormatYuv420P10Le(),
      frameDataLocation: FrameDataLocation.Hardware,
    });

    const filter = new TonemapFilter(currentState);
    const nextState = filter.nextState(currentState);

    expect(nextState.frameDataLocation).to.eq(FrameDataLocation.Software);
  });

  test('nextState sets pixelFormat to PixelFormatYuv420P', () => {
    const currentState = new FrameState({
      scaledSize: FrameSize.FHD,
      paddedSize: FrameSize.FHD,
      isAnamorphic: false,
      pixelFormat: new PixelFormatYuv420P10Le(),
      frameDataLocation: FrameDataLocation.Hardware,
    });

    const filter = new TonemapFilter(currentState);
    const nextState = filter.nextState(currentState);

    expect(nextState.pixelFormat).toMatchPixelFormat(new PixelFormatYuv420P());
  });

  test('filter includes tin=smpte2084 when colorTransfer is smpte2084 (HDR10)', () => {
    const currentState = new FrameState({
      scaledSize: FrameSize.FHD,
      paddedSize: FrameSize.FHD,
      isAnamorphic: false,
      pixelFormat: new PixelFormatYuv420P10Le(),
      frameDataLocation: FrameDataLocation.Software,
      colorFormat: new ColorFormat({
        colorTransfer: ColorTransferFormats.Smpte2084,
        colorSpace: ColorSpaces.Bt2020nc,
        colorPrimaries: ColorPrimaries.Bt2020,
        colorRange: ColorRanges.Tv,
      }),
    });

    const filter = new TonemapFilter(currentState);

    expect(filter.filter).toContain('zscale=t=linear:tin=smpte2084:npl=100');
  });

  test('filter includes tin=arib-std-b67 when colorTransfer is arib-std-b67 (HLG)', () => {
    const currentState = new FrameState({
      scaledSize: FrameSize.FHD,
      paddedSize: FrameSize.FHD,
      isAnamorphic: false,
      pixelFormat: new PixelFormatYuv420P10Le(),
      frameDataLocation: FrameDataLocation.Software,
      colorFormat: new ColorFormat({
        colorTransfer: ColorTransferFormats.AribStdB67,
        colorSpace: ColorSpaces.Bt2020nc,
        colorPrimaries: ColorPrimaries.Bt2020,
        colorRange: ColorRanges.Tv,
      }),
    });

    const filter = new TonemapFilter(currentState);

    expect(filter.filter).toContain('zscale=t=linear:tin=arib-std-b67:npl=100');
  });

  test('filter omits tin= when colorTransfer is null', () => {
    const currentState = new FrameState({
      scaledSize: FrameSize.FHD,
      paddedSize: FrameSize.FHD,
      isAnamorphic: false,
      pixelFormat: new PixelFormatYuv420P10Le(),
      frameDataLocation: FrameDataLocation.Software,
    });

    const filter = new TonemapFilter(currentState);

    expect(filter.filter).toContain('zscale=t=linear:npl=100');
    expect(filter.filter).not.toContain('tin=');
  });

  test('hardware location with smpte2084 includes hwdownload prefix and tin=smpte2084', () => {
    const currentState = new FrameState({
      scaledSize: FrameSize.FHD,
      paddedSize: FrameSize.FHD,
      isAnamorphic: false,
      pixelFormat: new PixelFormatYuv420P10Le(),
      frameDataLocation: FrameDataLocation.Hardware,
      colorFormat: new ColorFormat({
        colorTransfer: ColorTransferFormats.Smpte2084,
        colorSpace: ColorSpaces.Bt2020nc,
        colorPrimaries: ColorPrimaries.Bt2020,
        colorRange: ColorRanges.Tv,
      }),
    });

    const filter = new TonemapFilter(currentState);

    expect(filter.filter).toMatch(/^hwdownload,format=p010le\|nv12,/);
    expect(filter.filter).toContain('zscale=t=linear:tin=smpte2084:npl=100');
  });
});
