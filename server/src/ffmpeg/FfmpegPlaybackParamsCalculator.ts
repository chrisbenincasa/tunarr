import { StreamDetails, VideoStreamDetails } from '@/stream/types.ts';
import { gcd } from '@/util/index.ts';
import { FfmpegSettings, Resolution } from '@tunarr/types';
import { isNil, round } from 'lodash-es';
import { DeepReadonly } from 'ts-essentials';
import { OutputFormat } from './builder/constants.ts';
import {
  PixelFormat,
  PixelFormatYuv420P,
} from './builder/format/PixelFormat.ts';
import { FrameSize, HardwareAccelerationMode } from './builder/types.ts';

export class FfmpegPlaybackParamsCalculator {
  constructor(private ffmpegOptions: DeepReadonly<FfmpegSettings>) {}

  calculateForStream(streamDetails: StreamDetails): FfmpegPlaybackParams {
    // TODO: Check channel mode;
    const params: FfmpegPlaybackParams = {
      audioFormat: this.ffmpegOptions.audioEncoder,
      audioBitrate: this.ffmpegOptions.audioBitrate,
      audioBufferSize: this.ffmpegOptions.audioBufferSize,
      audioChannels: this.ffmpegOptions.audioChannels,
      audioSampleRate: this.ffmpegOptions.audioSampleRate,
      hwAccel: this.ffmpegOptions.hardwareAccelerationMode,
      videoFormat: this.ffmpegOptions.videoFormat,
      videoBitrate: this.ffmpegOptions.videoBitrate,
      videoBufferSize: this.ffmpegOptions.videoBufferSize,
    };

    if (streamDetails.videoDetails) {
      const [videoStream] = streamDetails.videoDetails;
      if (
        needsToScale(this.ffmpegOptions, videoStream) &&
        videoStream.sampleAspectRatio !== '0:0'
      ) {
        const scaledSize = calculateScaledSize(this.ffmpegOptions, videoStream);
        if (
          scaledSize.widthPx !== videoStream.width ||
          scaledSize.heightPx !== videoStream.height
        ) {
          params.scaledSize = FrameSize.fromResolution(scaledSize).ensureEven();
        }
      }

      const sizeAfterScaling =
        params.scaledSize ??
        FrameSize.create({
          width: videoStream.width,
          height: videoStream.height,
        });
      if (
        sizeAfterScaling.width !==
          this.ffmpegOptions.targetResolution.widthPx ||
        sizeAfterScaling.height !== this.ffmpegOptions.targetResolution.heightPx
      ) {
        params.needsPad = true;
      }

      // We only have an option for maxFPS right now...
      if (
        isNil(videoStream.framerate) ||
        round(videoStream.framerate, 3) > this.ffmpegOptions.maxFPS
      ) {
        params.frameRate = this.ffmpegOptions.maxFPS;
      }

      params.videoTrackTimeScale = 90000;

      // Filter for attached pic???
      // match([params.hwAccel, videoStream.codec, videoStream.pixelFormat])
      //   .with([HardwareAccelerationMode.Cuda, VideoFormats.H264, P.union(PixelFormats.YUV420P10LE, PixelFormats.YUV444P, PixelFormats.YUV444P10LE)], () => 'h264')
      //   .with([HardwareAccelerationMode.Cuda, VideoFormats.Hevc, P.union(PixelFormats.YUV420P10LE, PixelFormats.YUV444P, PixelFormats.YUV444P10LE)], () => 'h264')
      // TODO ffmpeg options for bit depth!
      params.pixelFormat = new PixelFormatYuv420P();

      params.deinterlace =
        this.ffmpegOptions.deinterlaceFilter !== 'none' &&
        videoStream.scanType === 'interlaced';
    }

    return params;
  }

  calculateForErrorStream(
    outputFormat: OutputFormat,
    hlsRealtime: boolean,
  ): FfmpegPlaybackParams {
    return {
      audioFormat: this.ffmpegOptions.audioEncoder,
      audioBitrate: this.ffmpegOptions.audioBitrate,
      audioBufferSize: this.ffmpegOptions.audioBufferSize,
      audioChannels: this.ffmpegOptions.audioChannels,
      audioSampleRate: this.ffmpegOptions.audioSampleRate,
      hwAccel: this.ffmpegOptions.hardwareAccelerationMode,
      videoFormat: this.ffmpegOptions.videoFormat,
      videoBitrate: this.ffmpegOptions.videoBitrate,
      videoBufferSize: this.ffmpegOptions.videoBufferSize,
      videoTrackTimeScale: 90_000,
      frameRate: 24,
      realtime: outputFormat.type === 'hls' ? hlsRealtime : true,
    };
  }

  calculateForHlsConcat() {
    return {
      audioFormat: this.ffmpegOptions.audioEncoder,
      audioBitrate: this.ffmpegOptions.audioBitrate,
      audioBufferSize: this.ffmpegOptions.audioBufferSize,
      audioChannels: this.ffmpegOptions.audioChannels,
      audioSampleRate: this.ffmpegOptions.audioSampleRate,
      hwAccel: this.ffmpegOptions.hardwareAccelerationMode,
      videoFormat: this.ffmpegOptions.videoFormat,
      videoBitrate: this.ffmpegOptions.videoBitrate,
      videoBufferSize: this.ffmpegOptions.videoBufferSize,
      videoTrackTimeScale: 90_000,
      frameRate: 24,
      realtime: false,
    };
  }
}

export type FfmpegPlaybackParams = {
  hwAccel: HardwareAccelerationMode;
  frameRate?: number;
  scaledSize?: FrameSize;
  needsPad?: boolean;
  videoTrackTimeScale?: number;
  realtime?: boolean;

  // video details
  videoFormat: string;
  videoBitrate: number;
  videoBufferSize: number;
  pixelFormat?: PixelFormat;
  deinterlace?: boolean;

  // audio details
  audioFormat: string;
  audioBitrate: number;
  audioBufferSize: number;
  audioChannels: number;
  audioSampleRate: number;
  audioDuration?: number;
};

function needsToScale(
  ffmpegOptions: DeepReadonly<FfmpegSettings>,
  videoStreamDetails: VideoStreamDetails,
) {
  return (
    isAnamorphic(videoStreamDetails) ||
    actualSizeDiffersFromDesired(
      videoStreamDetails,
      ffmpegOptions.targetResolution,
    ) ||
    videoStreamDetails.width % 2 == 1 ||
    videoStreamDetails.height % 2 == 1
  );
}

function actualSizeDiffersFromDesired(
  videoStream: VideoStreamDetails,
  targetResolution: Resolution,
) {
  return (
    videoStream.width !== targetResolution.widthPx ||
    videoStream.height !== targetResolution.heightPx
  );
}

function isAnamorphic(videoStreamDetails: VideoStreamDetails) {
  // Unclear if we can rely on this
  // if (isDefined(videoStreamDetails.anamorphic)) {
  //   return videoStreamDetails.anamorphic;
  // }
  if (videoStreamDetails.sampleAspectRatio === '1:1') {
    return false;
  }

  if (videoStreamDetails.sampleAspectRatio !== '0:1') {
    return true;
  }

  if (videoStreamDetails.displayAspectRatio === '0:1') {
    return false;
  }

  return (
    videoStreamDetails.displayAspectRatio !==
    `${videoStreamDetails.width}:${videoStreamDetails.height}`
  );
}

function calculateScaledSize(
  ffmpegOptions: DeepReadonly<FfmpegSettings>,
  videoStream: VideoStreamDetails,
) {
  const { widthPx: targetW, heightPx: targetH } =
    ffmpegOptions.targetResolution;
  const [width, height] = videoStream.sampleAspectRatio
    .split(':')
    .map((i) => parseInt(i));
  const sarSize: Resolution = { widthPx: width, heightPx: height };
  let pixelP = videoStream.width * sarSize.widthPx,
    pixelQ = videoStream.height * sarSize.heightPx;
  const g = gcd(pixelQ, pixelP);
  pixelP /= g;
  pixelQ /= g;

  const h1 = {
    widthPx: targetW,
    heightPx: targetW * (pixelQ / pixelP),
  } satisfies Resolution;
  const h2 = {
    widthPx: targetH * (pixelP / pixelQ),
    heightPx: targetH,
  } satisfies Resolution;

  // TODO implement crop scaling
  return h1.heightPx <= targetH ? h1 : h2;
}
