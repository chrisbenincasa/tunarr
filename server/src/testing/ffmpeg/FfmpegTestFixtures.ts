import { VideoStream } from '@/ffmpeg/builder/MediaStream.js';
import { VideoFormats } from '@/ffmpeg/builder/constants.js';
import { ColorFormat } from '@/ffmpeg/builder/format/ColorFormat.js';
import {
  KnownPixelFormats,
  PixelFormatUnknown,
} from '@/ffmpeg/builder/format/PixelFormat.js';
import { VideoInputSource } from '@/ffmpeg/builder/input/VideoInputSource.js';
import { FrameSize } from '@/ffmpeg/builder/types.js';
import { FfprobeStreamDetails } from '@/stream/FfprobeStreamDetails.js';
import { FileStreamSource } from '@/stream/types.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
  discoverVaapiOpenclSupport,
  type VaapiDeviceInfo,
} from './FfmpegIntegrationHelper.ts';

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
);

export const Fixtures = {
  video720p: path.join(fixturesDir, '720p_h264.ts'),
  video1080p: path.join(fixturesDir, '1080p_h264.ts'),
  video480p43: path.join(fixturesDir, '480p_h264.ts'),
  videoHevc720p: path.join(fixturesDir, '720p_hevc_hdr10.ts'),
  videoHevc1080p: path.join(fixturesDir, '1080p_hevc_hdr10.mp4'),
  watermark: path.join(fixturesDir, 'watermark.png'),
  blackWatermark: path.join(fixturesDir, 'black_watermark.png'),
} as const;

export async function deriveVideoStreamForFixture(
  fixturePath: string,
): Promise<VideoInputSource> {
  const ffprobeStreamDetails = new FfprobeStreamDetails(makeFfmpegInfo());
  const { streamDetails } = (
    await ffprobeStreamDetails.getStream({ path: fixturePath })
  ).getOrThrow();
  if (!streamDetails.videoDetails) {
    throw new Error(`File at ${fixturePath} has no video streams`);
  }
  const videoDetails = streamDetails.videoDetails[0];
  return VideoInputSource.withStream(
    new FileStreamSource(fixturePath),
    VideoStream.create({
      codec: videoDetails.codec ?? VideoFormats.Undetermined,
      profile: videoDetails.profile,
      displayAspectRatio: videoDetails.displayAspectRatio,
      frameSize: FrameSize.withDimensions(
        videoDetails.width,
        videoDetails.height,
      ),
      pixelFormat: videoDetails.pixelFormat
        ? (KnownPixelFormats.forPixelFormat(videoDetails.pixelFormat) ??
          PixelFormatUnknown(videoDetails.bitDepth ?? 8))
        : PixelFormatUnknown(videoDetails.bitDepth ?? 8),
      providedSampleAspectRatio: videoDetails.sampleAspectRatio ?? null,
      frameRate: videoDetails.framerate?.toString(),
      index: videoDetails.streamIndex ?? 0,
      colorFormat: new ColorFormat({
        colorRange: videoDetails.colorRange ?? null,
        colorSpace: videoDetails.colorSpace ?? null,
        colorTransfer: videoDetails.colorTransfer ?? null,
        colorPrimaries: videoDetails.colorPrimaries ?? null,
      }),
    }),
  );
}

export const binaries = discoverFfmpegBinaries();

export const vaapiInfo = discoverVaapiDevice();

export const qsvInfo = binaries
  ? discoverQsvCapabilities(binaries.ffmpeg)
  : null;

export const nvidiaCaps = binaries
  ? discoverNvidiaCapabilities(binaries.ffmpeg)
  : null;

export const vaapiOpenclSupported =
  binaries && vaapiInfo
    ? discoverVaapiOpenclSupport(binaries.ffmpeg, vaapiInfo.device)
    : false;

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
