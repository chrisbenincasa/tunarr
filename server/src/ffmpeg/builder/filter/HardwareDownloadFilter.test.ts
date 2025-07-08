import { HardwareDownloadFilter } from '@/ffmpeg/builder/filter/HardwareDownloadFilter.js';
import {
  PixelFormatNv12,
  PixelFormatP010,
  PixelFormatVaapi,
  PixelFormatYuv420P,
  PixelFormatYuv420P10Le,
} from '@/ffmpeg/builder/format/PixelFormat.js';
import { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import { FrameDataLocation, FrameSize } from '@/ffmpeg/builder/types.js';

describe('HardwareDownloadFilter', () => {
  test('vaapi download, 8-bit', () => {
    const currentState = new FrameState({
      isAnamorphic: false,
      scaledSize: FrameSize.FHD,
      paddedSize: FrameSize.FHD,
      pixelFormat: new PixelFormatVaapi(new PixelFormatYuv420P()),
      frameDataLocation: FrameDataLocation.Hardware,
    });

    const filter = new HardwareDownloadFilter(currentState);

    expect(filter.filter).to.eq('hwdownload,format=vaapi|nv12');
    expect(filter.nextState(currentState).frameDataLocation).to.eq(
      FrameDataLocation.Software,
    );
  });

  test('vaapi download, 10-bit', () => {
    const currentState = new FrameState({
      isAnamorphic: false,
      scaledSize: FrameSize.FHD,
      paddedSize: FrameSize.FHD,
      pixelFormat: new PixelFormatVaapi(new PixelFormatYuv420P10Le()),
      frameDataLocation: FrameDataLocation.Hardware,
    });

    const filter = new HardwareDownloadFilter(currentState);

    expect(filter.filter).to.eq('hwdownload,format=vaapi|p010le');
    expect(filter.nextState(currentState).frameDataLocation).to.eq(
      FrameDataLocation.Software,
    );
  });

  test('hwdownload, nv12', () => {
    const currentState = new FrameState({
      isAnamorphic: false,
      scaledSize: FrameSize.FHD,
      paddedSize: FrameSize.FHD,
      pixelFormat: new PixelFormatNv12(new PixelFormatYuv420P()),
      frameDataLocation: FrameDataLocation.Hardware,
    });

    const filter = new HardwareDownloadFilter(currentState);

    expect(filter.filter).to.eq('hwdownload,format=nv12');
    expect(filter.nextState(currentState).frameDataLocation).to.eq(
      FrameDataLocation.Software,
    );
  });

  test('hwdownload, yuv420p', () => {
    const currentState = new FrameState({
      isAnamorphic: false,
      scaledSize: FrameSize.FHD,
      paddedSize: FrameSize.FHD,
      pixelFormat: new PixelFormatYuv420P(),
      frameDataLocation: FrameDataLocation.Hardware,
    });

    const filter = new HardwareDownloadFilter(currentState);

    expect(filter.filter).to.eq('hwdownload,format=nv12');
    expect(filter.nextState(currentState).frameDataLocation).to.eq(
      FrameDataLocation.Software,
    );
  });

  test('hwdownload, p010', () => {
    const currentState = new FrameState({
      isAnamorphic: false,
      scaledSize: FrameSize.FHD,
      paddedSize: FrameSize.FHD,
      pixelFormat: new PixelFormatP010(),
      frameDataLocation: FrameDataLocation.Hardware,
    });

    const filter = new HardwareDownloadFilter(currentState);

    expect(filter.filter).to.eq('hwdownload,format=p010le');
    expect(filter.nextState(currentState).frameDataLocation).to.eq(
      FrameDataLocation.Software,
    );
  });

  test('hwdownload, yuv420p10le', () => {
    const currentState = new FrameState({
      isAnamorphic: false,
      scaledSize: FrameSize.FHD,
      paddedSize: FrameSize.FHD,
      pixelFormat: new PixelFormatYuv420P10Le(),
      frameDataLocation: FrameDataLocation.Hardware,
    });

    const filter = new HardwareDownloadFilter(currentState);

    expect(filter.filter).to.eq('hwdownload,format=p010le');
    expect(filter.nextState(currentState).frameDataLocation).to.eq(
      FrameDataLocation.Software,
    );
  });
});
