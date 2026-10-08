// @ts-ignore
import vaInfo10500 from '@/testing/resources/vainfo-10500.txt?raw';
// @ts-ignore
import vaInfo13500 from '@/testing/resources/vainfo-13500.txt?raw';
import { None } from '../../../types/util.ts';
import { VideoFormats } from '../constants.ts';
import {
  PixelFormatYuv420P,
  PixelFormatYuv420P10Le,
} from '../format/PixelFormat.ts';
import { RateControlMode } from '../types.ts';
import { VaapiHardwareCapabilitiesParser } from './VaapiHardwareCapabilitiesParser.ts';

test('extractAllFromVaInfo, 13500', async () => {
  const capabilites =
    VaapiHardwareCapabilitiesParser.extractAllFromVaInfo(vaInfo13500);

  expect(capabilites).not.toBeNull();
  expect(
    capabilites?.canEncode(VideoFormats.Hevc, None, new PixelFormatYuv420P()),
  ).toBe(true);
  expect(
    capabilites?.canEncode(
      VideoFormats.Hevc,
      None,
      new PixelFormatYuv420P10Le(),
    ),
  ).toBe(true);
  expect(
    capabilites?.canEncode(
      VideoFormats.Hevc,
      None,
      new PixelFormatYuv420P10Le(),
    ),
  ).toBe(true);
});

test('extractAllFromVaInfo, 10500', async () => {
  const capabilites =
    VaapiHardwareCapabilitiesParser.extractAllFromVaInfo(vaInfo13500);

  expect(capabilites).not.toBeNull();
  expect(
    capabilites?.canEncode(VideoFormats.Hevc, None, new PixelFormatYuv420P()),
  ).toBe(true);
  expect(
    capabilites?.canEncode(
      VideoFormats.Hevc,
      None,
      new PixelFormatYuv420P10Le(),
    ),
  ).toBe(true);
});

test('low power encode, 13500', () => {
  const capabilites =
    VaapiHardwareCapabilitiesParser.extractAllFromVaInfo(vaInfo13500);

  // The 13500 low power HEVC entrypoints support bitrate rate control.
  expect(
    capabilites?.canEncodeLowPower(VideoFormats.Hevc, new PixelFormatYuv420P()),
  ).toBe(true);
  expect(
    capabilites?.canEncodeLowPower(
      VideoFormats.Hevc,
      new PixelFormatYuv420P10Le(),
    ),
  ).toBe(true);
});

test('low power encode, 10500', () => {
  const capabilites =
    VaapiHardwareCapabilitiesParser.extractAllFromVaInfo(vaInfo10500);

  // The 10500 low power H264 entrypoint only reports CQP.
  expect(
    capabilites?.canEncode(VideoFormats.H264, None, new PixelFormatYuv420P()),
  ).toBe(true);
  expect(
    capabilites?.canEncodeLowPower(VideoFormats.H264, new PixelFormatYuv420P()),
  ).toBe(false);
});

test('parses rate control modes per entrypoint', () => {
  const capabilites = VaapiHardwareCapabilitiesParser.extractAllFromVaInfo(
    [
      'VAProfileH264Main/VAEntrypointEncSlice',
      '    VAConfigAttribRTFormat                 : VA_RT_FORMAT_YUV420',
      '    VAConfigAttribRateControl              : VA_RC_CQP',
      'VAProfileHEVCMain/VAEntrypointEncSlice',
      '    VAConfigAttribRTFormat                 : VA_RT_FORMAT_YUV420',
      '    VAConfigAttribRateControl              : VA_RC_CBR',
      '                                             VA_RC_VBR',
      '                                             VA_RC_CQP',
    ].join('\n'),
  );

  expect(
    capabilites?.getRateControlMode(
      VideoFormats.H264,
      new PixelFormatYuv420P(),
    ),
  ).toBe(RateControlMode.CQP);
  expect(
    capabilites?.getRateControlMode(
      VideoFormats.Hevc,
      new PixelFormatYuv420P(),
    ),
  ).toBeUndefined();
});
