import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration.js';
import type { TranscodeConfigOrm } from '@/db/schema/TranscodeConfig.js';
import type { StreamDetails } from '@/stream/types.js';
import { VideoPresets } from './builder/constants.ts';
import {
  FfmpegPlaybackParamsCalculator,
  type FfmpegPlaybackParams,
} from './FfmpegPlaybackParamsCalculator.ts';

dayjs.extend(duration);

function makeTranscodeConfig(
  overrides: Partial<TranscodeConfigOrm> = {},
): TranscodeConfigOrm {
  return {
    uuid: 'test-uuid',
    name: 'Test',
    threadCount: 0,
    hardwareAccelerationMode: 'none',
    vaapiDriver: 'system',
    vaapiDevice: null,
    resolution: { widthPx: 1920, heightPx: 1080 },
    videoFormat: 'h264',
    videoProfile: null,
    videoPreset: null,
    videoBitDepth: 8,
    videoBitRate: 2000,
    videoBufferSize: 4000,
    audioChannels: 2,
    audioFormat: 'aac',
    audioBitRate: 192,
    audioBufferSize: 384,
    audioSampleRate: 48,
    audioVolumePercent: 100,
    audioLoudnormConfig: null,
    normalizeFrameRate: false,
    deinterlaceVideo: true,
    disableChannelOverlay: false,
    errorScreen: 'pic',
    errorScreenAudio: 'silent',
    isDefault: true,
    disableHardwareDecoder: false,
    disableHardwareEncoding: false,
    disableHardwareFilters: false,
    ...overrides,
  } as TranscodeConfigOrm;
}

function makeStreamDetails(
  overrides: Partial<StreamDetails['videoDetails']> = {},
): StreamDetails {
  return {
    duration: dayjs.duration({ seconds: 30 }),
    videoDetails: [
      {
        codec: 'h264',
        profile: 'Main',
        width: 1920,
        height: 1080,
        framerate: 24,
        pixelFormat: 'yuv420p',
        bitDepth: 8,
        streamIndex: 0,
        sampleAspectRatio: '1:1',
        displayAspectRatio: '16:9',
        anamorphic: false,
        bitrate: 5000,
        isAttachedPic: false,
        colorRange: null,
        colorSpace: null,
        colorTransfer: null,
        colorPrimaries: null,
      },
    ],
  };
}

describe('FfmpegPlaybackParamsCalculator', () => {
  describe('calculateForStream', () => {
    test('sets videoPreset to veryfast for software h264 encoding', () => {
      const config = makeTranscodeConfig({
        hardwareAccelerationMode: 'none',
        videoFormat: 'h264',
      });

      const calculator = new FfmpegPlaybackParamsCalculator(config, 'hls');
      const params = calculator.calculateForStream(makeStreamDetails());

      expect(params.videoPreset).toBe(VideoPresets.VeryFast);
    });

    test('sets videoPreset to veryfast for software hevc encoding', () => {
      const config = makeTranscodeConfig({
        hardwareAccelerationMode: 'none',
        videoFormat: 'hevc',
      });

      const calculator = new FfmpegPlaybackParamsCalculator(config, 'hls');
      const params = calculator.calculateForStream(makeStreamDetails());

      expect(params.videoPreset).toBe(VideoPresets.VeryFast);
    });

    test('does not set videoPreset for hardware-accelerated encoding', () => {
      const config = makeTranscodeConfig({
        hardwareAccelerationMode: 'cuda',
        videoFormat: 'h264',
      });

      const calculator = new FfmpegPlaybackParamsCalculator(config, 'hls');
      const params = calculator.calculateForStream(makeStreamDetails());

      expect(params.videoPreset).toBeUndefined();
    });

    test('does not set videoPreset for mpeg2video format', () => {
      const config = makeTranscodeConfig({
        hardwareAccelerationMode: 'none',
        videoFormat: 'mpeg2video',
      });

      const calculator = new FfmpegPlaybackParamsCalculator(config, 'hls');
      const params = calculator.calculateForStream(makeStreamDetails());

      expect(params.videoPreset).toBeUndefined();
    });

    test('does not set videoPreset for HLS direct mode', () => {
      const config = makeTranscodeConfig({
        hardwareAccelerationMode: 'none',
        videoFormat: 'h264',
      });

      const calculator = new FfmpegPlaybackParamsCalculator(
        config,
        'hls_direct',
      );
      const params = calculator.calculateForStream(makeStreamDetails());

      expect(params.videoPreset).toBeUndefined();
    });

    test('does not set videoPreset for HLS direct v2 mode', () => {
      const config = makeTranscodeConfig({
        hardwareAccelerationMode: 'none',
        videoFormat: 'h264',
      });

      const calculator = new FfmpegPlaybackParamsCalculator(
        config,
        'hls_direct_v2',
      );
      const params = calculator.calculateForStream(makeStreamDetails());

      expect(params.videoPreset).toBeUndefined();
    });

    test('does not clobber videoProfile with the preset value', () => {
      const config = makeTranscodeConfig({
        hardwareAccelerationMode: 'none',
        videoFormat: 'h264',
      });

      const calculator = new FfmpegPlaybackParamsCalculator(config, 'hls');
      const params = calculator.calculateForStream(makeStreamDetails());

      // videoProfile should NOT contain a preset value
      expect(params.videoProfile).not.toBe(VideoPresets.VeryFast);
    });

    test('does not set videoPreset when there are no video details', () => {
      const config = makeTranscodeConfig({
        hardwareAccelerationMode: 'none',
        videoFormat: 'h264',
      });

      const calculator = new FfmpegPlaybackParamsCalculator(config, 'hls');
      const streamDetails: StreamDetails = {
        duration: dayjs.duration({ seconds: 30 }),
        // No videoDetails
      };

      const params = calculator.calculateForStream(streamDetails);

      expect(params.videoPreset).toBeUndefined();
    });
  });
});
