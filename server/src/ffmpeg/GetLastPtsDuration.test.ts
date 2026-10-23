import { describe, expect, test } from 'vitest';
import { accumulateStreamEnd } from './GetLastPtsDuration.js';

describe('HLS segment stream ends', () => {
  test('retains the audio tail when the final packet in file order is video', () => {
    const audio = accumulateStreamEnd(
      { endPts: -Infinity },
      'codec_type=audio|pts=14820219|duration=1920',
    );
    const ends = accumulateStreamEnd(
      audio,
      'codec_type=video|pts=14811978|duration=3003|side_data_type=MPEGTS Stream ID|id=224',
    );
    expect(ends).toEqual({ endPts: 14822139, audioEndPts: 14822139 });
  });

  test('compares packet ends rather than start timestamps', () => {
    const audio = accumulateStreamEnd(
      { endPts: -Infinity },
      'codec_type=audio|pts=90000|duration=1920',
    );
    const ends = accumulateStreamEnd(
      audio,
      'codec_type=video|pts=89000|duration=3003',
    );
    expect(ends).toEqual({ endPts: 92003, audioEndPts: 91920 });
  });
});
