// @ts-ignore
import vaInfo10500 from '@/testing/resources/vainfo-10500.txt?raw';
// @ts-ignore
import vaInfo13500 from '@/testing/resources/vainfo-13500.txt?raw';
import { None } from '../../../types/util.ts';
import { VideoFormats } from '../constants.ts';
import { RateControlMode } from '../types.ts';
import {
  PixelFormatYuv420P,
  PixelFormatYuv420P10Le,
} from '../format/PixelFormat.ts';
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

test('extractAllFromVaInfo leaves the rate control mode unset when VBR or CBR is available', () => {
  const capabilities =
    VaapiHardwareCapabilitiesParser.extractAllFromVaInfo(vaInfo10500);

  expect(
    capabilities?.getRateControlMode(
      VideoFormats.H264,
      new PixelFormatYuv420P(),
    ),
  ).toBeUndefined();
});

test('extractAllFromVaInfo selects CQP when it is the only rate control mode', () => {
  const vainfo = [
    'VAProfileH264Main/VAEntrypointEncSliceLP',
    '    VAConfigAttribRTFormat                 : VA_RT_FORMAT_YUV420',
    '    VAConfigAttribRateControl              : VA_RC_CQP',
    '    VAConfigAttribEncPackedHeaders         : VA_ENC_PACKED_HEADER_SEQUENCE',
  ].join('\n');

  const capabilities =
    VaapiHardwareCapabilitiesParser.extractAllFromVaInfo(vainfo);

  expect(
    capabilities?.getRateControlMode(
      VideoFormats.H264,
      new PixelFormatYuv420P(),
    ),
  ).toBe(RateControlMode.CQP);
});
