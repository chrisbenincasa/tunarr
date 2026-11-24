import { createTypeSearchField } from '@tunarr/shared/util';
import type { TerminalProgram } from '@tunarr/types';
import { getGrandparentItem } from '@tunarr/types';
import type { SearchFilter } from '@tunarr/types/schemas';
import { isNil } from 'lodash-es';

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
  switch (program.type) {
    case 'movie':
    case 'other_video':
    case 'music_video':
      return program.title;
    case 'episode': {
      const show = getGrandparentItem(program);
      if (!show) return program.title;
      const year = isNil(show.year) ? '' : ` (${show.year})`;
      const season = isNil(program.season?.index)
        ? ''
        : `S${pad2(program.season.index)}`;
      return `${program.title} - ${show.title}${year} ${season}E${pad2(program.episodeNumber)}`;
    }
    case 'track': {
      const artist = getGrandparentItem(program);
      if (!artist) return program.title;
      return `${program.title} - ${artist.title}`;
    }
  }
}
