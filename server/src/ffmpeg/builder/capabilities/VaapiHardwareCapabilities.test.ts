import { VideoFormats } from '@/ffmpeg/builder/constants.js';
import {
  PixelFormatYuv420P,
  PixelFormatYuv420P10Le,
} from '@/ffmpeg/builder/format/PixelFormat.js';
import { RateControlMode } from '@/ffmpeg/builder/types.js';
import {
  VaapiEntrypoint,
  VaapiHardwareCapabilities,
  VaapiProfileEntrypoint,
  VaapiProfiles,
} from './VaapiHardwareCapabilities.ts';

function entrypoint(
  profile: string,
  entrypoint: string,
  rateControlModes: RateControlMode[],
) {
  const ep = new VaapiProfileEntrypoint(profile, entrypoint);
  for (const mode of rateControlModes) {
    ep.addRateControlMode(mode);
  }
  return ep;
}

describe('VaapiHardwareCapabilities.canEncodeLowPower', () => {
  test('true when the low power entrypoint supports VBR', () => {
    const capabilities = new VaapiHardwareCapabilities([
      entrypoint(VaapiProfiles.HevcMain, VaapiEntrypoint.Encode, [
        RateControlMode.VBR,
      ]),
      entrypoint(VaapiProfiles.HevcMain, VaapiEntrypoint.EncodeLowPower, [
        RateControlMode.CQP,
        RateControlMode.VBR,
      ]),
    ]);

    expect(
      capabilities.canEncodeLowPower(
        VideoFormats.Hevc,
        new PixelFormatYuv420P(),
      ),
    ).toBe(true);
  });

  test('matches the low power entrypoint for the output bit depth', () => {
    const capabilities = new VaapiHardwareCapabilities([
      entrypoint(VaapiProfiles.HevcMain, VaapiEntrypoint.EncodeLowPower, [
        RateControlMode.CBR,
      ]),
    ]);

    expect(
      capabilities.canEncodeLowPower(
        VideoFormats.Hevc,
        new PixelFormatYuv420P(),
      ),
    ).toBe(true);
    expect(
      capabilities.canEncodeLowPower(
        VideoFormats.Hevc,
        new PixelFormatYuv420P10Le(),
      ),
    ).toBe(false);
  });

  test('false when the low power entrypoint only supports CQP', () => {
    const capabilities = new VaapiHardwareCapabilities([
      entrypoint(VaapiProfiles.H264Main, VaapiEntrypoint.Encode, [
        RateControlMode.VBR,
      ]),
      entrypoint(VaapiProfiles.H264Main, VaapiEntrypoint.EncodeLowPower, [
        RateControlMode.CQP,
      ]),
    ]);

    expect(
      capabilities.canEncodeLowPower(
        VideoFormats.H264,
        new PixelFormatYuv420P(),
      ),
    ).toBe(false);
  });

  test('false when there is no low power entrypoint', () => {
    const capabilities = new VaapiHardwareCapabilities([
      entrypoint(VaapiProfiles.H264Main, VaapiEntrypoint.Encode, [
        RateControlMode.VBR,
      ]),
    ]);

    expect(
      capabilities.canEncodeLowPower(
        VideoFormats.H264,
        new PixelFormatYuv420P(),
      ),
    ).toBe(false);
    expect(
      capabilities.canEncode(
        VideoFormats.H264,
        undefined,
        new PixelFormatYuv420P(),
      ),
    ).toBe(true);
  });

  test('false for MPEG-2', () => {
    const capabilities = new VaapiHardwareCapabilities([
      entrypoint(VaapiProfiles.Mpeg2Main, VaapiEntrypoint.Encode, [
        RateControlMode.VBR,
      ]),
    ]);

    expect(
      capabilities.canEncodeLowPower(
        VideoFormats.Mpeg2Video,
        new PixelFormatYuv420P(),
      ),
    ).toBe(false);
  });
});
