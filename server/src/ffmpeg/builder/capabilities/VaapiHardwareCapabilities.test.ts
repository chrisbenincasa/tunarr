import { VideoFormats } from '../constants.ts';
import { PixelFormatYuv420P } from '../format/PixelFormat.ts';
import {
  VaapiEntrypoint,
  VaapiHardwareCapabilities,
  VaapiProfileEntrypoint,
  VaapiProfiles,
} from './VaapiHardwareCapabilities.ts';

describe('VaapiHardwareCapabilities', () => {
  describe('canEncode mpeg2video', () => {
    test.each([VaapiEntrypoint.Encode, VaapiEntrypoint.EncodeLowPower])(
      'true with an MPEG-2 Main %s entrypoint',
      (entrypoint) => {
        const capabilities = new VaapiHardwareCapabilities([
          new VaapiProfileEntrypoint(VaapiProfiles.Mpeg2Main, entrypoint),
        ]);

        expect(
          capabilities.canEncode(
            VideoFormats.Mpeg2Video,
            undefined,
            new PixelFormatYuv420P(),
          ),
        ).toBe(true);
      },
    );

    test('false with only an MPEG-2 decode entrypoint', () => {
      const capabilities = new VaapiHardwareCapabilities([
        new VaapiProfileEntrypoint(
          VaapiProfiles.Mpeg2Main,
          VaapiEntrypoint.Decode,
        ),
      ]);

      expect(
        capabilities.canEncode(
          VideoFormats.Mpeg2Video,
          undefined,
          new PixelFormatYuv420P(),
        ),
      ).toBe(false);
    });
  });
});
