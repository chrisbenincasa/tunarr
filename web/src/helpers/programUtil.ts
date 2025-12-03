import { createExternalId } from '@tunarr/shared';
import type {
  ProgramGrouping,
  ProgramOrFolder,
  TerminalProgram,
} from '@tunarr/types';
import {
  isTerminalItemType,
  tag,
  type ChannelProgram,
  type ContentProgram,
} from '@tunarr/types';
import type { SearchRequest } from '@tunarr/types/api';
import dayjs from 'dayjs';
import { match, P } from 'ts-pattern';
import { postApiProgramsSearch } from '../generated/sdk.gen.ts';
import type { Nullable } from '../types/util.ts';
import { prettyItemDuration } from './util.ts';

function getGrandparentExternalId(program: ContentProgram) {
  const sourceType = program.externalSourceType;
  const grandparentId = program.grandparent?.externalIds.find(
    (eid) => eid.source === sourceType,
  );
  if (!grandparentId) {
    return 'unknown';
  }
  if (grandparentId.type === 'single') {
    return 'unknown;';
  }

  return createExternalId(
    grandparentId.source,
    tag(grandparentId.sourceId),
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
      .with({ type: 'content' }, (program) => {
        const grandparentId =
          program.grandparent?.id ?? getGrandparentExternalId(program);
        return `${program.subtype === 'episode' ? 'show' : 'artist'}.${grandparentId}`;
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
      dateValue = program.year;
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
