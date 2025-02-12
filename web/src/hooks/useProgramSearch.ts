import type { UseQueryOptions } from '@tanstack/react-query';
import { queryOptions } from '@tanstack/react-query';
import {
  createParentFilterSearchField,
  createTypeSearchField,
} from '@tunarr/shared/util';
import type { ProgramLike } from '@tunarr/types';
import type { ProgramSearchResponse, SearchFilter } from '@tunarr/types/api';
import type { ApiClient } from '../external/api.ts';
import type { Nullable } from '../types/util.ts';

export function getChildSearchFilter(
  item: ProgramLike,
): Nullable<SearchFilter> {
  switch (item.type) {
    // No children items
    case 'episode':
    case 'movie':
    case 'track':
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

export const programChildSearchQueryOpts =
  (apiClient: ApiClient) =>
  (item: ProgramLike): ProgramChildSearchQueryOptions =>
    queryOptions({
      queryFn: () =>
        apiClient.searchPrograms({
          libraryId: item.libraryId,
          query: {
            // query: searchRequest?.query,
            filter: getChildSearchFilter(item),
          },
        }),
      queryKey: ['programs', item.uuid, 'children'],
      select(data) {
        return data.results;
      },
    });

// export const useProgramChildrenSearch = ()
