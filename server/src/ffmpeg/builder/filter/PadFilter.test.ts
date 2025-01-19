import { PadFilter } from '@/ffmpeg/builder/filter/PadFilter.js';
import {
  PixelFormatVaapi,
  PixelFormatYuv420P,
  PixelFormatYuv420P10Le,
} from '@/ffmpeg/builder/format/PixelFormat.js';
import { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import { FrameDataLocation, FrameSize } from '@/ffmpeg/builder/types.js';

describe('PadFilter', () => {
  test('generates pad filter', () => {
    const currentState = new FrameState({
      isAnamorphic: false,
      scaledSize: FrameSize.FHD,
      paddedSize: FrameSize.FourK,
      frameDataLocation: FrameDataLocation.Software,
    });

    const filter = new PadFilter(currentState, currentState);

    expect(filter.filter).to.eq('pad=3840:2160:-1:-1:color=black');
  });

  test('downloads pixels to software if necessary', () => {
    const currentState = new FrameState({
      isAnamorphic: false,
      scaledSize: FrameSize.FHD,
      paddedSize: FrameSize.FourK,
      frameDataLocation: FrameDataLocation.Hardware,
    });

    const filter = new PadFilter(currentState, currentState);

    expect(filter.filter).to.eq('hwdownload,pad=3840:2160:-1:-1:color=black');
    expect(filter.nextState(currentState).frameDataLocation).to.eq(
      FrameDataLocation.Software,
    );
  });

  test('downloads pixels to software if necessary vaapi 8-bit', () => {
    const currentState = new FrameState({
      isAnamorphic: false,
      scaledSize: FrameSize.FHD,
      paddedSize: FrameSize.FourK,
      frameDataLocation: FrameDataLocation.Hardware,
      pixelFormat: new PixelFormatVaapi(new PixelFormatYuv420P()),
    });

    const filter = new PadFilter(currentState, currentState);

    expect(filter.filter).to.eq(
      'hwdownload,format=vaapi|nv12,pad=3840:2160:-1:-1:color=black',
    );
    expect(filter.nextState(currentState).frameDataLocation).to.eq(
      FrameDataLocation.Software,
    );
  });

  test('downloads pixels to software if necessary vaapi 10-bit', () => {
    const currentState = new FrameState({
      isAnamorphic: false,
      scaledSize: FrameSize.FHD,
      paddedSize: FrameSize.FourK,
      frameDataLocation: FrameDataLocation.Hardware,
      pixelFormat: new PixelFormatVaapi(new PixelFormatYuv420P10Le()),
    });

    const filter = new PadFilter(currentState, currentState);

    expect(filter.filter).to.eq(
      'hwdownload,format=vaapi|p010,pad=3840:2160:-1:-1:color=black',
    );
    expect(filter.nextState(currentState).frameDataLocation).to.eq(
      FrameDataLocation.Software,
    );
  });
});
