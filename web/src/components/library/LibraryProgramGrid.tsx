import { Box, LinearProgress, Typography } from '@mui/material';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { MediaSourceLibrary, ProgramOrFolder } from '@tunarr/types';
import { type ProgramLike } from '@tunarr/types';
import type { ProgramSearchResponse, SearchRequest } from '@tunarr/types/api';
import { isEmpty, isUndefined, last } from 'lodash-es';
import { useCallback, useEffect, useMemo } from 'react';
import { postApiProgramsSearch } from '../../generated/sdk.gen.ts';
import { useProgramHierarchy } from '../../hooks/channel_config/useProgramHierarchy.ts';
import { getChildSearchFilter } from '../../hooks/useProgramSearch.ts';
import useStore from '../../store/index.ts';
import {
  addKnownMediaForServer,
  setSearchRequest,
} from '../../store/programmingSelector/actions.ts';
import type {
  RenderNestedGrid} from '../channel_config/MediaItemGrid.tsx';
import {
  MediaItemGrid,
  type GridItemProps,
} from '../channel_config/MediaItemGrid.tsx';
import { MediaItemList } from '../channel_config/MediaItemList.tsx';
import SelectedProgrammingActions from '../channel_config/SelectedProgrammingActions.tsx';
import { SearchBuilder } from '../search/SearchBuilder.tsx';
import { ProgramGridItem } from './ProgramGridItem.tsx';
import { ProgramListItem } from './ProgramListItem.tsx';

type Props = {
  library: MediaSourceLibrary;
  disableProgramSelection?: boolean;
  toggleOrSetSelectedProgramsDrawer?: (open: boolean) => void;
  depth?: number;
  parentContext?: ProgramOrFolder[];
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
  const searchRequest = useStore((s) => s.currentSearchRequest);
  const currentParentContext = last(parentContext);
  const viewType = useStore((state) => state.theme.programmingSelectorView);
  const programHierarchy = useProgramHierarchy(
    useCallback((p: ProgramOrFolder) => p.uuid, []),
  );

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
      restrictSeachTo: searchRequest?.restrictSearchTo,
    };
  }, [
    currentParentContext,
    library.mediaType,
    searchRequest?.filter,
    searchRequest?.query,
    searchRequest?.restrictSearchTo,
  ]);

  const search = useInfiniteQuery({
    queryKey: ['programs', 'search', query, library.id],
    queryFn: async ({ pageParam }) => {
      const { data } = await postApiProgramsSearch({
        body: {
          libraryId: library.id,
          query: query,
          limit: 45,
          page: pageParam,
        },
        throwOnError: true,
      });
      return data;
    },
    getNextPageParam: (last) => {
      const nextPage = last.page + 1;
      // We can't always trust the total hits. Meilisearch
      // by default maxes out at 1000. You can configure this
      // but it makes search slow. We just keep querying until
      // there are no more results!
      if (last.totalHits < 1_000 && nextPage > last.totalPages) {
        return;
      } else if (last.totalHits >= 1_000 && last.results.length === 0) {
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

  const handleSearchChange = useCallback((searchRequest: SearchRequest) => {
    setSearchRequest(searchRequest);
  }, []);

  useEffect(() => {
    const d = search.data?.pages.flatMap((page) => {
      return page.results;
    });

    if (!isEmpty(d)) {
      addKnownMediaForServer(library.mediaSource.id, d!);
    }
  }, [library.mediaSource.id, search.data?.pages]);

  const renderGridItem = (gridItemProps: GridItemProps<ProgramOrFolder>) => {
    return (
      <ProgramGridItem
        key={gridItemProps.item.uuid}
        disableSelection={disableProgramSelection}
        {...gridItemProps}
      />
    );
  };

  const renderNestedGrid: RenderNestedGrid<ProgramOrFolder> = useCallback(
    (props) => {
      return (
        <LibraryProgramGrid
          {...props}
          parentContext={props.parent ? [props.parent] : []}
          library={library}
          disableProgramSelection={disableProgramSelection}
        />
      );
    },
    [library, disableProgramSelection],
  );

  const totalHits = search.data?.pages?.[0].totalHits;

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
          {!isUndefined(totalHits) && (
            <Typography textAlign="right" variant="subtitle2">
              Total hits: {totalHits >= 1000 ? '>1000' : totalHits}
            </Typography>
          )}
        </>
      )}
      {search.isLoading && <LinearProgress />}
      {viewType === 'grid' ? (
        <MediaItemGrid
          depth={depth}
          infiniteQuery={search}
          renderGridItem={renderGridItem}
          renderNestedGrid={renderNestedGrid}
          extractItems={(page: ProgramSearchResponse) => page.results}
          getItemKey={(result: ProgramOrFolder) => result.uuid}
          getPageDataSize={(page: ProgramSearchResponse) => ({
            size: page.results.length,
            total: page.totalHits,
          })}
        />
      ) : (
        <MediaItemList
          infiniteQuery={search}
          extractItems={(page: ProgramSearchResponse) => page.results}
          getPageDataSize={(page: ProgramSearchResponse) => ({
            size: page.results.length,
            total: page.totalHits,
          })}
          renderListItem={({ item, index, style }) => (
            <ProgramListItem
              key={item.uuid}
              item={item}
              index={index}
              style={style}
              onPushParent={programHierarchy.pushParentContext}
              disableSelection={disableProgramSelection}
            />
          )}
        />
      )}
    </Box>
  );
};
