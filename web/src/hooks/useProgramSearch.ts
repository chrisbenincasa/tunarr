import { queryOptions, type UseQueryOptions } from '@tanstack/react-query';
import {
  createParentFilterSearchField,
  createTypeSearchField,
} from '@tunarr/shared/util';
import type { ProgramLike, ProgramOrFolder } from '@tunarr/types';
import type { ProgramSearchResponse, SearchFilter } from '@tunarr/types/api';
import { postApiProgramsSearchOptions } from '../generated/@tanstack/react-query.gen.ts';
import type { Nullable } from '../types/util.ts';

export function getChildSearchFilter(
  item: ProgramOrFolder,
): Nullable<SearchFilter> {
  switch (item.type) {
    // No children items
    case 'episode':
    case 'movie':
    case 'track':
    case 'music_video':
    case 'other_video':
    case 'collection': // These aren't supported in imported libraries yet
    case 'folder':
    case 'playlist':
      return null;
    case 'season':
      return {
        type: 'op',
        op: 'and',
        children: [
          createTypeSearchField('episode'),
          createParentFilterSearchField(item.uuid),
        ],
      };
    case 'show':
      return {
        type: 'op',
        op: 'and',
        children: [
          createTypeSearchField('season'),
          createParentFilterSearchField(item.uuid),
        ],
      };
    case 'album':
      return {
        type: 'op',
        op: 'and',
        children: [
          createTypeSearchField('track'),
          createParentFilterSearchField(item.uuid),
        ],
      };
    case 'artist':
      return {
        type: 'op',
        op: 'and',
        children: [
          createTypeSearchField('album'),
          createParentFilterSearchField(item.uuid),
        ],
      };
  }
}
export type ProgramChildSearchQueryOptions = UseQueryOptions<
  ProgramSearchResponse,
  Error,
  ProgramLike[],
  ['programs', string, 'children']
>;

export const programChildSearchQueryOpts = (item: ProgramLike) =>
  queryOptions({
    ...postApiProgramsSearchOptions({
      body: {
        libraryId: item.libraryId,
        query: {
          filter: getChildSearchFilter(item),
        },
      },
    }),
    select(data) {
      return data.results;
    },
  });
