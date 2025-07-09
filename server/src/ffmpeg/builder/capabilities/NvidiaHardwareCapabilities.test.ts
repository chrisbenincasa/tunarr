import fc from 'fast-check';
import { VideoFormats } from '../constants.ts';
import {
  PixelFormatYuv420P,
  PixelFormatYuv420P10Le,
} from '../format/PixelFormat.ts';
import { NvidiaHardwareCapabilities } from './NvidiaHardwareCapabilities.ts';

describe('NvidiaHardwareCapabilities', () => {
  test('Quadro M2000 can decode HEVC 10-bit', () => {
    const capabilities = new NvidiaHardwareCapabilities('Quadro M2000', 52);
    expect(
      capabilities.canDecode(
        VideoFormats.Hevc,
        undefined,
        new PixelFormatYuv420P10Le(),
      ),
    ).toBeTruthy();
  });

  test('any card SM 6.0 or higher can decode HEVC', () => {
    fc.assert(
      fc.property(fc.string(), fc.integer(), (model, arch) => {
        const capabilities = new NvidiaHardwareCapabilities(model, arch);
        const val = arch >= 60;
        expect(
          capabilities.canDecode(
            VideoFormats.Hevc,
            undefined,
            new PixelFormatYuv420P10Le(),
          ),
        ).toBe(val);
      }),
    );
  });

  test('any card SM 6.0 or higher can encode 10-bit HEVC', () => {
    fc.assert(
      fc.property(fc.string(), fc.integer(), (model, arch) => {
        const capabilities = new NvidiaHardwareCapabilities(model, arch);
        const val = arch >= 60;
        expect(
          capabilities.canEncode(
            VideoFormats.Hevc,
            undefined,
            new PixelFormatYuv420P10Le(),
          ),
        ).toBe(val);
      }),
    );
  });

  test('any card SM 5.2 or higher can encode 8-bit HEVC', () => {
    fc.assert(
      fc.property(fc.string(), fc.integer(), (model, arch) => {
        const capabilities = new NvidiaHardwareCapabilities(model, arch);
        const val = arch >= 52;
        expect(
          capabilities.canEncode(
            VideoFormats.Hevc,
            undefined,
            new PixelFormatYuv420P(),
          ),
        ).toBe(val);
      }),
    );
  });

  test('any card can decode 8-bit H264', () => {
    fc.assert(
      fc.property(fc.string(), fc.integer(), (model, arch) => {
        const capabilities = new NvidiaHardwareCapabilities(model, arch);
        expect(
          capabilities.canDecode(
            VideoFormats.H264,
            undefined,
            new PixelFormatYuv420P(),
          ),
        ).toBeTruthy();
      }),
    );
  });

  test('no card can decode 10-bit H264', () => {
    fc.assert(
      fc.property(fc.string(), fc.integer(), (model, arch) => {
        const capabilities = new NvidiaHardwareCapabilities(model, arch);
        expect(
          capabilities.canDecode(
            VideoFormats.H264,
            undefined,
            new PixelFormatYuv420P10Le(),
          ),
        ).toBeFalsy();
      }),
    );
  });

  test('no card can encode 10-bit H264', () => {
    fc.assert(
      fc.property(fc.string(), fc.integer(), (model, arch) => {
        const capabilities = new NvidiaHardwareCapabilities(model, arch);
        expect(
          capabilities.canEncode(
            VideoFormats.H264,
            undefined,
            new PixelFormatYuv420P10Le(),
          ),
        ).toBeFalsy();
      }),
    );
  });

  test('any card can decode mpeg2', () => {
    fc.assert(
      fc.property(fc.string(), fc.integer(), (model, arch) => {
        const capabilities = new NvidiaHardwareCapabilities(model, arch);
        expect(
          capabilities.canDecode(
            VideoFormats.Mpeg2Video,
            undefined,
            new PixelFormatYuv420P(),
          ),
        ).toBeTruthy();
      }),
    );
  });

  test('any card can decode vc1', () => {
    fc.assert(
      fc.property(fc.string(), fc.integer(), (model, arch) => {
        const capabilities = new NvidiaHardwareCapabilities(model, arch);
        expect(
          capabilities.canDecode(
            VideoFormats.Mpeg2Video,
            undefined,
            new PixelFormatYuv420P(),
          ),
        ).toBeTruthy();
      }),
    );
  });

  test('no card can decode mpeg4', () => {
    fc.assert(
      fc.property(fc.string(), fc.integer(), (model, arch) => {
        const capabilities = new NvidiaHardwareCapabilities(model, arch);
        expect(
          capabilities.canDecode(
            VideoFormats.Mpeg4,
            undefined,
            new PixelFormatYuv420P(),
          ),
        ).toBeFalsy();
      }),
    );
  });

  test('cards with Compute SM >8.6 can decode AV1', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.integer().filter((n) => n > 0),
        (model, arch) => {
          const capabilities = new NvidiaHardwareCapabilities(model, arch);
          let ex = false;
          if (arch >= 86) {
            ex = true;
          }
          expect(
            capabilities.canDecode(
              VideoFormats.Av1,
              undefined,
              new PixelFormatYuv420P(),
            ),
          ).toBe(ex);
        },
      ),
    );
  });

  test('cards with Compute SM >8.0 can encode AV1', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.integer().filter((n) => n > 0),
        (model, arch) => {
          const capabilities = new NvidiaHardwareCapabilities(model, arch);
          let ex = false;
          if (arch >= 80) {
            ex = true;
          }
          expect(
            capabilities.canEncode(
              VideoFormats.Av1,
              undefined,
              new PixelFormatYuv420P(),
            ),
          ).toBe(ex);
        },
      ),
    );
  });
});
