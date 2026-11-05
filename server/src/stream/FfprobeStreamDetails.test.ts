import { describe, expect, test } from 'vitest';
import type { FfprobeAudioStream } from '../types/ffmpeg.ts';
import { FfprobeMediaInfoSchema } from '../types/ffmpeg.ts';
import {
  audioStreamDetailsFromProbe,
  secondsToWholeMs,
} from './FfprobeStreamDetails.ts';

describe('secondsToWholeMs', () => {
  test('strips float noise from the seconds conversion', () => {
    expect(secondsToWholeMs(8.021)).toBe(8021);
  });

  test('rounds sub-millisecond precision down', () => {
    expect(secondsToWholeMs(1548.021999)).toBe(1_548_021);
  });

  test('returns integers across a range of millisecond inputs', () => {
    for (let ms = 1_000_000; ms < 1_010_000; ms++) {
      expect(secondsToWholeMs(ms / 1000)).toBe(ms);
    }
  });
});

describe('audioStreamDetailsFromProbe', () => {
  const probe = FfprobeMediaInfoSchema.parse({
    streams: [
      {
        index: 1,
        codec_type: 'audio',
        codec_name: 'aac',
        channels: 2,
        disposition: { default: 1, forced: 0 },
        tags: { language: 'jpn' },
      },
      {
        index: 2,
        codec_type: 'audio',
        codec_name: 'aac',
        channels: 6,
        disposition: { default: 0, forced: 0 },
        tags: { language: 'eng' },
      },
    ],
    format: {
      nb_streams: 2,
      format_name: 'matroska',
      duration: 60,
      size: 1,
      bit_rate: 1,
    },
  });
  const audio = probe.streams.filter(
    (stream): stream is FfprobeAudioStream => stream.codec_type === 'audio',
  );

  test('keeps the channel count', () => {
    expect(
      audio.map(audioStreamDetailsFromProbe).map((s) => s.channels),
    ).toEqual([2, 6]);
  });

  test('reads the default flag from the disposition', () => {
    expect(
      audio.map(audioStreamDetailsFromProbe).map((s) => s.default),
    ).toEqual([true, false]);
  });
});
