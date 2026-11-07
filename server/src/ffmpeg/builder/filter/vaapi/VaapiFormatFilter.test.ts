import { VaapiFormatFilter } from '@/ffmpeg/builder/filter/vaapi/VaapiFormatFilter.js';
import {
  PixelFormatNv12,
  PixelFormatP010,
  PixelFormatYuv420P,
  PixelFormatYuv420P10Le,
} from '@/ffmpeg/builder/format/PixelFormat.js';

import { ColorFormat } from '../../format/ColorFormat.ts';
import { FrameState } from '../../state/FrameState.ts';
import { FrameSize } from '../../types.ts';

describe('VaapiFormatFilter', () => {
  test('normalizes all four SDR color fields, including partially tagged BT.709', () => {
    const current = new FrameState({
      scaledSize: FrameSize.FHD,
      paddedSize: FrameSize.FHD,
      isAnamorphic: false,
      pixelFormat: new PixelFormatNv12(new PixelFormatYuv420P()),
      colorFormat: new ColorFormat({
        colorRange: 'tv',
        colorSpace: 'bt709',
        colorPrimaries: null,
        colorTransfer: null,
      }),
    });
    const filter = new VaapiFormatFilter(new PixelFormatYuv420P(), 64, true);
    expect(filter.filter).toBe(
      'scale_vaapi=format=nv12:extra_hw_frames=64:out_color_matrix=bt709:out_color_primaries=bt709:out_color_transfer=bt709:out_range=tv',
    );
    expect(filter.nextState(current).colorFormat).toEqual(ColorFormat.bt709);
  });

  test('yuv420p', () => {
    const filter = new VaapiFormatFilter(new PixelFormatYuv420P());
    expect(filter.filter).to.eq(`scale_vaapi=format=nv12:extra_hw_frames=64`);
  });

  test('yuv420p10le', () => {
    const filter = new VaapiFormatFilter(new PixelFormatYuv420P10Le());
    expect(filter.filter).to.eq(`scale_vaapi=format=p010le:extra_hw_frames=64`);
  });

  test('nv12', () => {
    const filter = new VaapiFormatFilter(
      new PixelFormatNv12(new PixelFormatYuv420P()),
    );
    expect(filter.filter).to.eq(`scale_vaapi=format=nv12:extra_hw_frames=64`);
  });

  test('p010', () => {
    const filter = new VaapiFormatFilter(new PixelFormatP010());
    expect(filter.filter).to.eq(`scale_vaapi=format=p010le:extra_hw_frames=64`);
  });
});
