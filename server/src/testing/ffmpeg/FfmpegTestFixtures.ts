import pino from 'pino';
import { test as base } from 'vitest';
import type { FfmpegCapabilities } from '../../ffmpeg/builder/capabilities/FfmpegCapabilities.ts';
import type { NvidiaHardwareCapabilities } from '../../ffmpeg/builder/capabilities/NvidiaHardwareCapabilities.ts';
import type { QsvHardwareCapabilities } from '../../ffmpeg/builder/capabilities/QsvHardwareCapabilities.ts';
import type { FfmpegVersionResult } from '../../ffmpeg/ffmpegInfo.ts';
import { FfmpegInfo } from '../../ffmpeg/ffmpegInfo.ts';
import type { Logger } from '../../util/logging/LoggerFactory.ts';
import {
  discoverFfmpegBinaries,
  discoverNvidiaCapabilities,
  discoverQsvCapabilities,
  discoverVaapiDevice,
  type VaapiDeviceInfo,
} from './FfmpegIntegrationHelper.ts';

export const binaries = discoverFfmpegBinaries();

export const vaapiInfo = discoverVaapiDevice();

export const qsvInfo = binaries
  ? discoverQsvCapabilities(binaries.ffmpeg)
  : null;

export const nvidiaCaps = binaries
  ? discoverNvidiaCapabilities(binaries.ffmpeg)
  : null;

const noopLogger = pino({ level: 'silent' }) as Logger;

function makeFfmpegInfo(): FfmpegInfo {
  // Instantiate directly, ignoring Inversify DI bindings
  return new FfmpegInfo(binaries!.ffmpeg, binaries!.ffprobe, noopLogger);
}

export type FfmpegTestFixtures = {
  ffmpegInfo: FfmpegInfo;
  binaryCapabilities: FfmpegCapabilities;
  ffmpegVersion: FfmpegVersionResult;
};

export const ffmpegTest = base.extend<FfmpegTestFixtures>({
  ffmpegInfo: [
    async ({}, use) => {
      const info = makeFfmpegInfo();
      await info.seed();
      await use(info);
    },
    { scope: 'file' },
  ],

  binaryCapabilities: [
    async ({ ffmpegInfo }, use) => {
      await use(await ffmpegInfo.getCapabilities());
    },
    { scope: 'file' },
  ],

  ffmpegVersion: [
    async ({ ffmpegInfo }, use) => {
      await use(await ffmpegInfo.getVersion());
    },
    { scope: 'file' },
  ],
});

export const vaapiTest = ffmpegTest.extend<{ resolvedVaapi: VaapiDeviceInfo }>({
  resolvedVaapi: [
    async ({}, use) => {
      await use(vaapiInfo!);
    },
    { scope: 'file' },
  ],
});

export const qsvTest = ffmpegTest.extend<{
  resolvedQsv: { device: string; capabilities: QsvHardwareCapabilities };
}>({
  resolvedQsv: [
    async ({}, use) => {
      await use(qsvInfo!);
    },
    { scope: 'file' },
  ],
});

export const nvidiaTest = ffmpegTest.extend<{
  resolvedNvidia: NvidiaHardwareCapabilities;
}>({
  resolvedNvidia: [
    async ({}, use) => {
      await use(nvidiaCaps!);
    },
    { scope: 'file' },
  ],
});
