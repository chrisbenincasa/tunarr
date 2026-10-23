import { describe, expect, test } from 'vitest';
import { calculateHlsPtsOffset } from './HlsPtsOffset.js';

describe('HLS next clip offset', () => {
  test('keeps the next AAC priming packet beyond the observed Diet Coke audio tail', () => {
    const offset = calculateHlsPtsOffset(
      { endPts: 14822139, audioEndPts: 14822139 },
      { audioFormat: 'aac', audioSampleRate: 48 },
    );
    expect(offset).toBe(14824060);
    expect(offset - (1024 * 90000) / 48000).toBe(14822140);
  });

  test.each([48, 44.1])(
    'accounts for AC3 priming at %s kHz',
    (audioSampleRate) => {
      const offset = calculateHlsPtsOffset(
        { endPts: 90000, audioEndPts: 90000 },
        { audioFormat: 'ac3', audioSampleRate },
      );
      const firstAudio = offset - (256 * 90000) / (audioSampleRate * 1000);
      expect(firstAudio).toBeGreaterThan(90000);
      expect(firstAudio).toBeLessThan(90002);
    },
  );

  test('does not add an audio gap when the video end already covers priming', () => {
    expect(
      calculateHlsPtsOffset(
        { endPts: 93000, audioEndPts: 90000 },
        { audioFormat: 'aac', audioSampleRate: 48 },
      ),
    ).toBe(93001);
  });
});
