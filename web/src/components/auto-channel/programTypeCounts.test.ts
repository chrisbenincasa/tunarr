import { describe, expect, test } from 'vitest';
import { programTypeCounts } from './programTypeCounts.ts';

describe('programTypeCounts', () => {
  test('drops types with no matches', () => {
    expect(
      programTypeCounts({
        movie: 3,
        episode: 0,
        track: 0,
        music_video: 0,
        other_video: 2,
      }).map((c) => c.type),
    ).toEqual(['movie', 'other_video']);
  });

  test('uses readable nouns and the singular for one', () => {
    expect(programTypeCounts({ music_video: 1, other_video: 4 })).toEqual([
      { type: 'music_video', count: 1, noun: 'music video' },
      { type: 'other_video', count: 4, noun: 'other videos' },
    ]);
  });

  test('returns nothing for an empty breakdown', () => {
    expect(programTypeCounts({})).toEqual([]);
  });
});
