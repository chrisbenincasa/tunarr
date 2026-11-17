import dayjs from '../../util/dayjs.ts';
import { describe, expect, test } from 'vitest';
import type { StreamDetails } from '../../stream/types.ts';
import { mediaStreamsFromProbe } from './mediaStreamsFromProbe.ts';

const details: StreamDetails = {
  duration: dayjs.duration(60, 'seconds'),
  audioDetails: [
    { index: 1, codec: 'aac', channels: 2, default: true, language: 'jpn' },
    { index: 2, codec: 'aac', channels: 6, default: false, language: 'eng' },
  ],
  subtitleDetails: [
    {
      type: 'embedded',
      index: 3,
      codec: 'subrip',
      default: false,
      forced: true,
      language: 'spa',
    },
  ],
};

const ofType = (type: string) =>
  mediaStreamsFromProbe(details).filter((s) => s.streamType === type);

describe('mediaStreamsFromProbe', () => {
  test('keeps audio channel counts', () => {
    expect(ofType('audio').map((s) => s.channels)).toEqual([2, 6]);
  });

  test('keeps the audio default flags', () => {
    expect(ofType('audio').map((s) => s.default)).toEqual([true, false]);
  });

  test('keeps the subtitle default and forced flags', () => {
    expect(ofType('subtitles')).toMatchObject([
      { index: 3, default: false, forced: true, languageCodeISO6392: 'spa' },
    ]);
  });
});
