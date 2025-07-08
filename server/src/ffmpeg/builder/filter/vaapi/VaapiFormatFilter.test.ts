import { VaapiFormatFilter } from '@/ffmpeg/builder/filter/vaapi/VaapiFormatFilter.js';
import {
  PixelFormatNv12,
  PixelFormatP010,
  PixelFormatYuv420P,
  PixelFormatYuv420P10Le,
} from '@/ffmpeg/builder/format/PixelFormat.js';

describe('VaapiFormatFilter', () => {
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
