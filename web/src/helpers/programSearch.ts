import { createTypeSearchField } from '@tunarr/shared/util';
import type { TerminalProgram } from '@tunarr/types';
import { getGrandparentItem } from '@tunarr/types';
import type { SearchFilter } from '@tunarr/types/schemas';
import { isNil } from 'lodash-es';
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

const pad2 = (n: number) => n.toString().padStart(2, '0');

export function formatTerminalProgramTitle(program: TerminalProgram): string {
  return match(program)
    .with(
      { type: P.union('movie', 'other_video', 'music_video') },
      (video) => video.title,
    )
    .with({ type: 'episode' }, (ep) => {
      const show = getGrandparentItem(ep);
      if (!show) return ep.title;
      const year = isNil(show.year) ? '' : ` (${show.year})`;
      const season = isNil(ep.season?.index) ? '' : `S${pad2(ep.season.index)}`;
      return `${ep.title} - ${show.title}${year} ${season}E${pad2(ep.episodeNumber)}`;
    })
    .with({ type: 'track' }, (track) => {
      const artist = getGrandparentItem(track);
      if (!artist) return track.title;
      return `${track.title} - ${artist.title}`;
    })
    .exhaustive();
}
