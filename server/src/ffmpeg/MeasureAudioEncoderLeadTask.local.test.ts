import { describe, expect } from 'vitest';
import { binaries, ffmpegTest } from '../testing/ffmpeg/FfmpegTestFixtures.ts';
import { MeasureAudioEncoderLeadTask } from './MeasureAudioEncoderLeadTask.ts';

describe('MeasureAudioEncoderLeadTask', () => {
  ffmpegTest('measures the AAC priming delay', async () => {
    if (!binaries) {
      throw new Error('ffmpeg binaries were not found');
    }

    const result = await new MeasureAudioEncoderLeadTask(binaries.ffmpeg).run({
      encoder: 'aac',
      sampleRateKhz: 48,
      channels: 2,
    });

    // 1024 priming samples at 48 kHz.
    expect(result.getOrThrow()).toBe(1920);
  });

  ffmpegTest('measures the AC3 delay', async () => {
    if (!binaries) {
      throw new Error('ffmpeg binaries were not found');
    }

    const result = await new MeasureAudioEncoderLeadTask(binaries.ffmpeg).run({
      encoder: 'ac3',
      sampleRateKhz: 48,
      channels: 2,
    });

    // 256 delay samples at 48 kHz.
    expect(result.getOrThrow()).toBe(480);
  });

  ffmpegTest('fails for an unknown encoder', async () => {
    if (!binaries) {
      throw new Error('ffmpeg binaries were not found');
    }

    const result = await new MeasureAudioEncoderLeadTask(binaries.ffmpeg).run({
      encoder: 'not_an_encoder',
      sampleRateKhz: 48,
      channels: 2,
    });

    expect(result.isFailure()).toBe(true);
  });
});
