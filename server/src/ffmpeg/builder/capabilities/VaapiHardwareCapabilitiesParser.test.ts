// @ts-ignore
import vaInfo13500 from '@/testing/resources/vainfo-13500.txt?raw';
import { None } from '../../../types/util.ts';
import { VideoFormats } from '../constants.ts';
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
