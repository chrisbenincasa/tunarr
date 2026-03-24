import { createExternalId } from '@tunarr/shared';
import type {
  Episode,
  MusicAlbum,
  MusicArtist,
  MusicTrack,
  ProgramGrouping,
  ProgramOrFolder,
  Season,
  Show,
  TerminalProgram,
} from '@tunarr/types';
import { isTerminalItemType, tag, type ChannelProgram } from '@tunarr/types';
import {
  isValidSingleExternalIdType,
  type SearchRequest,
} from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import { isEmpty, isNil } from 'lodash-es';
import { match, P } from 'ts-pattern';
import { postApiProgramsSearch } from '../generated/sdk.gen.ts';
import type { Maybe, Nullable } from '../types/util.ts';
import { prettyItemDuration } from './util.ts';

export function extractProgramGrandparent(
  program: TerminalProgram,
): Maybe<Show | MusicArtist> {
  return match(program)
    .with({ type: 'episode' }, (ep) => ep.show ?? ep.season?.show)
    .with({ type: 'track' }, (track) => track.artist ?? track.album?.artist)
    .otherwise(() => undefined);
}

export function extractProgramParent(
  program: TerminalProgram,
): Maybe<Season | MusicAlbum> {
  return match(program)
    .with({ type: 'episode' }, (ep) => ep.season)
    .with({ type: 'track' }, (track) => track.album)
    .otherwise(() => undefined);
}

function getGrandparentExternalId(program: TerminalProgram) {
  const sourceType = program.sourceType;
  const grandparentId = extractProgramGrandparent(program)?.identifiers.find(
    (eid) => eid.type === sourceType,
  );
  if (!grandparentId) {
    return 'unknown';
  }
  if (
    isValidSingleExternalIdType(grandparentId.type) ||
    isEmpty(grandparentId.sourceId)
  ) {
    return 'unknown;';
  }

  return createExternalId(
    grandparentId.type,
    tag(grandparentId.sourceId!),
    grandparentId.id,
  );
}

export function getProgramGroupingKey(program: ChannelProgram): string {
  return (
    match(program)
      .with(
        {
          type: 'content',
          subtype: P.select(P.union('movie', 'music_video', 'other_video')),
        },
        (typ) => typ,
      )
      .with({ type: 'content' }, ({ program }) => {
        const grandparentId =
          extractProgramGrandparent(program)?.uuid ??
          getGrandparentExternalId(program);
        return `${program.type === 'episode' ? 'show' : 'artist'}.${grandparentId}`;
      })
      // .with({type: 'content', persisted: false}, program => {
      //   const grandparentId = program.grandparent
      // })
      .with({ type: 'custom' }, (program) => `custom.${program.customShowId}`)
      .with({ type: 'redirect' }, (program) => `redirect.${program.channel}`)
      .with({ type: 'flex' }, () => 'flex')
      .with({ type: 'filler' }, (program) => `filler.${program.fillerListId}`)
      .exhaustive()
  );
}

export async function enumerateSyncedItems(
  mediaSourceId: string,
  libraryId: Nullable<string>,
  searchRequest: Nullable<SearchRequest>,
) {
  const results: ProgramOrFolder[] = [];
  const loop = async (page?: number): Promise<ProgramOrFolder[]> => {
    const result = await postApiProgramsSearch({
      body: {
        mediaSourceId,
        libraryId: libraryId ?? undefined,
        query: {
          query: searchRequest?.query,
          filter: searchRequest?.filter,
          restrictSearchTo: searchRequest?.restrictSearchTo,
        },
        limit: 50,
        page,
      },
      throwOnError: true,
    });

    if (result.data.results.length === 0) {
      return results;
    }

    results.push(...result.data.results);

    return loop(result.data.page + 1);
  };

  return loop();
}

export function getProgramDuration(program: TerminalProgram | ProgramGrouping) {
  if (isTerminalItemType(program)) {
    return prettyItemDuration(program.duration);
  }

  return;
}

export function getProgramRating(program: TerminalProgram | ProgramGrouping) {
  let rating;

  switch (program.type) {
    case 'season':
    case 'episode':
      rating = program?.show?.rating;
      break;
    case 'movie':
    case 'show':
      rating = program?.rating;
      break;
    default:
      return;
  }
  return rating;
}

export function getProgramSummary(program: TerminalProgram | ProgramGrouping) {
  switch (program.type) {
    case 'movie':
    case 'show':
      return program.plot ?? program.summary;
    case 'episode':
      return program.summary;
    case 'season':
      return program.show?.plot;
    case 'artist':
      return program.summary;
    case 'album':
      return program.plot;
    default:
      return '';
  }
}

export function getProgramGenres(program: TerminalProgram | ProgramGrouping) {
  switch (program.type) {
    case 'season':
      return program?.genres?.length ? program?.genres : program?.show?.genres;
    case 'episode':
      return program?.genres?.length ? program?.genres : program?.show?.genres;
    case 'track':
      return program?.genres?.length ? program?.genres : program?.album?.genres;
    default:
      return program.genres;
  }
}

export function getProgramReleaseDate(
  program: TerminalProgram | ProgramGrouping,
  format?: string,
) {
  let dateValue;
  const dateFormat = format || 'MMMM D, YYYY';

  switch (program.type) {
    case 'movie':
    case 'show':
    case 'other_video':
    case 'music_video':
      dateValue = program.releaseDate
        ? dayjs(program.releaseDate).format(dateFormat)
        : program.year;
      break;
    case 'season':
      dateValue = program.show?.releaseDate
        ? dayjs(program.show?.releaseDate).format(dateFormat)
        : '';
      break;
    case 'episode':
    case 'album':
    case 'track':
      dateValue = program.releaseDate
        ? dayjs(program.releaseDate).format(dateFormat)
        : '';
      break;
    default:
      return '';
  }

  return dateValue;
}

export function getEpisodeShowId(episode: Episode) {
  return episode.show?.uuid ?? episode.season?.show?.uuid;
}

export function getTrackArtistId(track: MusicTrack) {
  return track.artist?.uuid ?? track.album?.artist?.uuid;
}

export function getCanonicalOrderIndex(program: TerminalProgram) {
  switch (program.type) {
    case 'movie':
    case 'other_video':
    case 'music_video':
      return 1;
    case 'episode':
    case 'track': {
      let n = 1;
      const parent = extractProgramParent(program)?.index;
      if (!isNil(parent)) {
        n *= parent * 1e4;
      }
      if (program.type === 'episode' && !isNil(program.episodeNumber)) {
        n += program.episodeNumber * 1e2;
      } else if (program.type === 'track' && !isNil(program.trackNumber)) {
        n += program.trackNumber * 1e2;
      }

      return n;
    }
  }
}

export function extractProgramIndex(program: TerminalProgram) {
  switch (program.type) {
    case 'movie':
    case 'other_video':
    case 'music_video':
      return 1;
    case 'episode':
      return program.episodeNumber;
    case 'track':
      return program.trackNumber;
  }
}
