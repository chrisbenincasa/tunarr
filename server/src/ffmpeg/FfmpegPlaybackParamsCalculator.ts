import type { TranscodeConfig } from '@/db/schema/TranscodeConfig.js';
import {
  HardwareAccelerationMode,
  TranscodeAudioOutputFormat,
} from '@/db/schema/TranscodeConfig.js';
import type { ChannelStreamMode } from '@/db/schema/base.js';
import type { StreamDetails, VideoStreamDetails } from '@/stream/types.js';
import { gcd } from '@/util/index.js';
import { numberToBoolean } from '@/util/sqliteUtil.js';
import type { Resolution } from '@tunarr/types';
import { ChannelStreamModes } from '@tunarr/types';
import type { OutputFormat, VideoFormat } from './builder/constants.ts';
import type { PixelFormat } from './builder/format/PixelFormat.ts';
import { PixelFormatYuv420P } from './builder/format/PixelFormat.ts';
import { FrameSize } from './builder/types.ts';

export class FfmpegPlaybackParamsCalculator {
  constructor(
    private transcodeConfig: TranscodeConfig,
    private streamMode: ChannelStreamMode,
  ) {}

  calculateForStream(streamDetails: StreamDetails): FfmpegPlaybackParams {
    if (this.streamMode === ChannelStreamModes.HlsDirect) {
      return {
        hwAccel: HardwareAccelerationMode.None,
        audioFormat: TranscodeAudioOutputFormat.Copy,
        videoFormat: 'copy', // Should be included in DB options
        deinterlace: false,
      } satisfies FfmpegPlaybackParams;
    }

    // TODO: Check channel mode;
    const params: FfmpegPlaybackParams = {
      audioFormat: this.transcodeConfig.audioFormat,
      audioBitrate: this.transcodeConfig.audioBitRate,
      audioBufferSize: this.transcodeConfig.audioBufferSize,
      audioChannels: this.transcodeConfig.audioChannels,
      audioSampleRate: this.transcodeConfig.audioSampleRate,
      hwAccel: this.transcodeConfig.hardwareAccelerationMode,
      videoFormat: this.transcodeConfig.videoFormat,
      videoBitrate: this.transcodeConfig.videoBitRate,
      videoBufferSize: this.transcodeConfig.videoBufferSize,
    };

    if (streamDetails.videoDetails) {
      const [videoStream] = streamDetails.videoDetails;
      if (
        needsToScale(this.transcodeConfig, videoStream) &&
        videoStream.sampleAspectRatio !== '0:0'
      ) {
        const scaledSize = calculateScaledSize(
          this.transcodeConfig,
          videoStream,
        );
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
        sizeAfterScaling.width !== this.transcodeConfig.resolution.widthPx ||
        sizeAfterScaling.height !== this.transcodeConfig.resolution.heightPx
      ) {
        params.needsPad = true;
      }

      // We only have an option for maxFPS right now...
      // if (
      //   isNil(videoStream.framerate) ||
      //   round(videoStream.framerate, 3) > this.ffmpegOptions.maxFPS
      // ) {
      //   params.frameRate = this.ffmpegOptions.maxFPS;
      // }

      params.videoTrackTimeScale = 90000;

      // Filter for attached pic???
      // match([params.hwAccel, videoStream.codec, videoStream.pixelFormat])
      //   .with([HardwareAccelerationMode.Cuda, VideoFormats.H264, P.union(PixelFormats.YUV420P10LE, PixelFormats.YUV444P, PixelFormats.YUV444P10LE)], () => 'h264')
      //   .with([HardwareAccelerationMode.Cuda, VideoFormats.Hevc, P.union(PixelFormats.YUV420P10LE, PixelFormats.YUV444P, PixelFormats.YUV444P10LE)], () => 'h264')
      // TODO ffmpeg options for bit depth!
      params.pixelFormat = new PixelFormatYuv420P();

      params.deinterlace =
        numberToBoolean(this.transcodeConfig.deinterlaceVideo) &&
        videoStream.scanType === 'interlaced';
    }

    return params;
  }

  calculateForErrorStream(
    outputFormat: OutputFormat,
    hlsRealtime: boolean,
  ): FfmpegPlaybackParams {
    return {
      audioFormat: this.transcodeConfig.audioFormat,
      audioBitrate: this.transcodeConfig.audioBitRate,
      audioBufferSize: this.transcodeConfig.audioBufferSize,
      audioChannels: this.transcodeConfig.audioChannels,
      audioSampleRate: this.transcodeConfig.audioSampleRate,
      hwAccel: this.transcodeConfig.hardwareAccelerationMode,
      videoFormat: this.transcodeConfig.videoFormat,
      videoBitrate: this.transcodeConfig.videoBitRate,
      videoBufferSize: this.transcodeConfig.videoBufferSize,
      videoTrackTimeScale: 90_000,
      frameRate: 24,
      realtime: outputFormat.type === 'hls' ? hlsRealtime : true,
    };
  }

  calculateForHlsConcat() {
    return {
      audioFormat: this.transcodeConfig.audioFormat,
      audioBitrate: this.transcodeConfig.audioBitRate,
      audioBufferSize: this.transcodeConfig.audioBufferSize,
      audioChannels: this.transcodeConfig.audioChannels,
      audioSampleRate: this.transcodeConfig.audioSampleRate,
      hwAccel: this.transcodeConfig.hardwareAccelerationMode,
      videoFormat: this.transcodeConfig.videoFormat,
      videoBitrate: this.transcodeConfig.videoBitRate,
      videoBufferSize: this.transcodeConfig.videoBufferSize,
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
  videoFormat: VideoFormat;
  videoBitrate?: number;
  videoBufferSize?: number;
  pixelFormat?: PixelFormat;
  deinterlace?: boolean;

  // audio details
  audioFormat: TranscodeAudioOutputFormat;
  audioBitrate?: number;
  audioBufferSize?: number;
  audioChannels?: number;
  audioSampleRate?: number;
  audioDuration?: number;
};

function needsToScale(
  transcodeConfig: TranscodeConfig,
  videoStreamDetails: VideoStreamDetails,
) {
  return (
    isAnamorphic(videoStreamDetails) ||
    actualSizeDiffersFromDesired(
      videoStreamDetails,
      transcodeConfig.resolution,
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
  config: TranscodeConfig,
  videoStream: VideoStreamDetails,
) {
  const { widthPx: targetW, heightPx: targetH } = config.resolution;
  const [width, height] = (videoStream.sampleAspectRatio ?? '1:1')
    .split(':')
    .map((i) => parseInt(i));
  const sarSize: Resolution = { widthPx: width!, heightPx: height! };
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
