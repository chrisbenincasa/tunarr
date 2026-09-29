import { createTypeSearchField } from '@tunarr/shared/util';
import type { TerminalProgram } from '@tunarr/types';
import { getGrandparentItem } from '@tunarr/types';
import type { SearchFilter } from '@tunarr/types/schemas';
import { match, P } from 'ts-pattern';

// Matches every program type that can actually play.
export const terminalTypeFilter: SearchFilter = {
  op: 'or',
  type: 'op',
  children: [
    createTypeSearchField('movie'),
    createTypeSearchField('music_video'),
    createTypeSearchField('other_video'),
    createTypeSearchField('episode'),
    createTypeSearchField('track'),
  ],
};

export function formatTerminalProgramTitle(program: TerminalProgram): string {
  return match(program)
    .with(
      { type: P.union('movie', 'other_video', 'music_video') },
      (video) => video.title,
    )
    .with({ type: 'episode' }, (ep) => {
      const show = getGrandparentItem(ep);
      if (!show) return ep.title;
      const season =
        ep.season?.index !== undefined
          ? ep.season?.index?.toString().padStart(2, '0')
          : null;
      return `${ep.title} - ${show.title} (${show.year}) S${season}E${ep.episodeNumber.toString().padStart(2, '0')}`;
    })
    .with({ type: 'track' }, (track) => {
      const artist = getGrandparentItem(track);
      if (!artist) return track.title;
      return `${track.title} - ${artist.title}`;
    })
    .exhaustive();
}
