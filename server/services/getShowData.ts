import { Program } from 'dizquetv-types';
import { isUndefined } from 'lodash-es';

// Temporary type until we sort this out...
export type ShowData = {
  hasShow: boolean;
  showId?: string;
  showDisplayName?: string;
  order?: number;
  channel?: number;
};

//This is an exact copy of the file with the same now in the web project
//one of these days, we'll figure out how to share the code.

// What is the minimal data we need here?
type ShowDataProgram = Omit<
  Program,
  'summary' | 'icon' | 'plexFile' | 'episodeIcon' | 'ratingKey'
>;

export default function () {
  const movieTitleOrder: Record<string, number> = {};
  let movieTitleOrderNumber = 0;

  return (program: ShowDataProgram): ShowData => {
    if (typeof program.customShowId !== 'undefined') {
      return {
        hasShow: true,
        showId: 'custom.' + program.customShowId,
        showDisplayName: program.customShowName,
        order: program.customOrder,
      };
    } else if (program.isOffline && program.type === 'redirect') {
      return {
        hasShow: true,
        showId: 'redirect.' + program.channel,
        order: program.duration,
        showDisplayName: `Redirect to channel ${program.channel}`,
        channel: program.channel,
      };
    } else if (program.isOffline) {
      return {
        hasShow: false,
      };
    } else if (program.type === 'movie') {
      const key = program.serverKey + '|' + program.key;
      if (isUndefined(movieTitleOrder[key])) {
        movieTitleOrder[key] = movieTitleOrderNumber++;
      }
      return {
        hasShow: true,
        showId: 'movie.',
        showDisplayName: 'Movies',
        order: movieTitleOrder[key],
      };
    } else if (program.type === 'episode' || program.type === 'track') {
      let s = 0;
      let e = 0;
      if (typeof program.season !== 'undefined') {
        s = program.season;
      }
      if (typeof program.episode !== 'undefined') {
        e = program.episode;
      }
      let prefix = 'tv.';
      if (program.type === 'track') {
        prefix = 'audio.';
      }
      return {
        hasShow: true,
        showId: prefix + program.showTitle,
        showDisplayName: program.showTitle,
        order: s * 1000000 + e,
      };
    } else {
      return {
        hasShow: false,
      };
    }
  };
}
