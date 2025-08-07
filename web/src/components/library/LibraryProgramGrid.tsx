import { Box, LinearProgress } from '@mui/material';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { MediaSourceLibrary } from '@tunarr/types';
import { type ProgramLike } from '@tunarr/types';
import type { ProgramSearchResponse, SearchRequest } from '@tunarr/types/api';
import { isEmpty, last } from 'lodash-es';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getChildSearchFilter } from '../../hooks/useProgramSearch.ts';
import { useTunarrApi } from '../../hooks/useTunarrApi.ts';
import { Route } from '../../routes/channels_/$channelId/programming/add.tsx';
import { addKnownMediaFromLibrary } from '../../store/programmingSelector/actions.ts';
import type { Nullable } from '../../types/util.ts';
import {
  MediaItemGrid,
  type GridItemProps,
} from '../channel_config/MediaItemGrid.tsx';
import SelectedProgrammingActions from '../channel_config/SelectedProgrammingActions.tsx';
import { SearchBuilder } from '../search/SearchBuilder.tsx';
import { ProgramGridItem } from './ProgramGridItem.tsx';

type Props = {
  library: MediaSourceLibrary;
  disableProgramSelection?: boolean;
  toggleOrSetSelectedProgramsDrawer?: (open: boolean) => void;
  depth?: number;
  parentContext?: ProgramLike[];
};

function searchItemTypeFromLibraryType(
  mediaType: MediaSourceLibrary['mediaType'],
): ProgramLike['type'] {
  switch (mediaType) {
    case 'movies':
      return 'movie';
    case 'shows':
      return 'show';
    case 'tracks':
      return 'artist';
    case 'other_videos':
    case 'music_videos':
      throw new Error('unsupported');
  }
}

export const LibraryProgramGrid = ({
  library,
  disableProgramSelection,
  toggleOrSetSelectedProgramsDrawer,
  depth = 0,
  parentContext = [],
}: Props) => {
  const [searchRequest, setSearchRequest] =
    useState<Nullable<SearchRequest>>(null);
  const navigate = Route.useNavigate();
  const apiClient = useTunarrApi();

  const currentParentContext = last(parentContext);
  const query = useMemo<SearchRequest>(() => {
    if (currentParentContext) {
      return {
        filter: getChildSearchFilter(currentParentContext),
      };
    }

    return {
      query: searchRequest?.query,
      filter: searchRequest?.filter ?? {
        type: 'value',
        fieldSpec: {
          key: 'type',
          name: 'Type',
          op: '=',
          type: 'string',
          value: [searchItemTypeFromLibraryType(library.mediaType)],
        },
      },
      restrictSeachTo: searchRequest?.restrictSeachTo,
    };
  }, [
    currentParentContext,
    library.mediaType,
    searchRequest?.filter,
    searchRequest?.query,
    searchRequest?.restrictSeachTo,
  ]);
  const search = useInfiniteQuery({
    queryKey: ['programs', 'search', query, library.id],
    queryFn: ({ pageParam }) => {
      return apiClient.searchPrograms({
        libraryId: library.id,
        query: query,
        limit: 10,
        page: pageParam,
      });
    },
    getNextPageParam: (last) => {
      const nextPage = last.page + 1;
      if (nextPage > last.totalPages) {
        return;
      }
      return nextPage;
    },
    getPreviousPageParam: (last) => {
      const prevPage = last.page - 1;
      if (prevPage <= 0) {
        return;
      }
      return prevPage;
    },
    initialPageParam: 1,
    staleTime: 0,
  });

  const handleSearchChange = useCallback(
    (searchRequest: SearchRequest) => {
      setSearchRequest(searchRequest);
      navigate({
        replace: true,
        search: {
          searchRequest: btoa(JSON.stringify(searchRequest)),
        },
      })
        .then(console.log)
        .catch(console.warn);
    },
    [navigate],
  );

  useEffect(() => {
    const d = search.data?.pages.flatMap((page) => {
      return page.results;
    });

    if (!isEmpty(d)) {
      addKnownMediaFromLibrary(library.mediaSource.id, d!);
    }
  }, [library.mediaSource.id, search.data?.pages]);

  const renderGridItem = (gridItemProps: GridItemProps<ProgramLike>) => {
    return (
      <ProgramGridItem
        key={gridItemProps.item.uuid}
        disableSelection={disableProgramSelection}
        {...gridItemProps}
      />
    );
  };

  return (
    <Box>
      {depth === 0 && (
        <>
          <SearchBuilder library={library} onSearch={handleSearchChange} />
          {!disableProgramSelection && toggleOrSetSelectedProgramsDrawer && (
            <SelectedProgrammingActions
              toggleOrSetSelectedProgramsDrawer={
                toggleOrSetSelectedProgramsDrawer
              }
            />
          )}
        </>
      )}

      {search.isLoading && <LinearProgress />}
      <MediaItemGrid<ProgramSearchResponse, ProgramLike>
        depth={depth}
        infiniteQuery={search}
        renderGridItem={renderGridItem}
        renderNestedGrid={(props) => (
          <LibraryProgramGrid
            {...props}
            parentContext={props.parent ? [props.parent] : []}
            library={library}
            disableProgramSelection={disableProgramSelection}
          />
        )}
        extractItems={(page: ProgramSearchResponse) => page.results}
        getItemKey={(result: ProgramLike) => result.uuid}
        getPageDataSize={(page: ProgramSearchResponse) => ({
          size: page.results.length,
          total: page.totalHits,
        })}
      />
    </Box>
  );
};
