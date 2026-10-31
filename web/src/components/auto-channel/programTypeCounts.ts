import type { ContentProgramType } from '@tunarr/types/schemas';

const Nouns: Record<ContentProgramType, [singular: string, plural: string]> = {
  movie: ['movie', 'movies'],
  episode: ['episode', 'episodes'],
  track: ['track', 'tracks'],
  music_video: ['music video', 'music videos'],
  other_video: ['other video', 'other videos'],
};

export type ProgramTypeCount = {
  type: ContentProgramType;
  count: number;
  noun: string;
};

// Types with no matches are left out.
export function programTypeCounts(
  byType: Partial<Record<ContentProgramType, number>>,
): ProgramTypeCount[] {
  return (Object.keys(Nouns) as ContentProgramType[]).flatMap((type) => {
    const count = byType[type] ?? 0;
    if (count === 0) {
      return [];
    }
    const [singular, plural] = Nouns[type];
    return [{ type, count, noun: count === 1 ? singular : plural }];
  });
}
