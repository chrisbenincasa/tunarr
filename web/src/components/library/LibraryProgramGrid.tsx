import { Box, LinearProgress, Typography } from '@mui/material';
import { useInfiniteQuery } from '@tanstack/react-query';
import { isNonEmptyString } from '@tunarr/shared/util';
import type {
  MediaSourceContentType,
  MediaSourceLibrary,
  MediaSourceSettings,
  ProgramOrFolder,
} from '@tunarr/types';
import { type ProgramLike } from '@tunarr/types';
import type { SearchFilter } from '@tunarr/types/api';
import {
  type ProgramSearchResponse,
  type SearchRequest,
} from '@tunarr/types/api';
import { groupBy, isEmpty, isUndefined, last } from 'lodash-es';
import { useCallback, useEffect, useMemo } from 'react';
import { match, P } from 'ts-pattern';
import { postApiProgramsSearch } from '../../generated/sdk.gen.ts';
import { useProgramHierarchy } from '../../hooks/channel_config/useProgramHierarchy.ts';
import { getChildSearchFilter } from '../../hooks/useProgramSearch.ts';
import useStore from '../../store/index.ts';
import { addKnownMediaForServer } from '../../store/programmingSelector/actions.ts';
import type { Maybe } from '../../types/util.ts';
import type { RenderNestedGrid } from '../channel_config/MediaItemGrid.tsx';
import {
  MediaItemGrid,
  type GridItemProps,
} from '../channel_config/MediaItemGrid.tsx';
import { MediaItemList } from '../channel_config/MediaItemList.tsx';
import { ProgramGridItem } from './ProgramGridItem.tsx';
import { ProgramListItem } from './ProgramListItem.tsx';

type Props = {
  mediaSource?: MediaSourceSettings;
  library?: MediaSourceLibrary;
  disableProgramSelection?: boolean;
  depth?: number;
  parentContext?: ProgramOrFolder[];
  searchRequest?: SearchRequest;
};

function searchItemTypeFromContentType(
  mediaType: MediaSourceContentType,
): ProgramLike['type'] {
  switch (mediaType) {
    case 'movies':
      return 'movie';
    case 'shows':
      return 'show';
    case 'tracks':
      return 'artist';
    case 'other_videos':
      return 'other_video';
    case 'music_videos':
      return 'music_video';
  }
}

function typeFilter(mediaType: MediaSourceContentType): SearchFilter {
  return {
    type: 'value',
    fieldSpec: {
      key: 'type',
      name: 'Type',
      op: '=',
      type: 'string',
      value: [searchItemTypeFromContentType(mediaType)],
    },
  };
}

export const LibraryProgramGrid = ({
  mediaSource,
  library,
  disableProgramSelection,
  depth = 0,
  parentContext = [],
  searchRequest: staticSearchRequest,
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

    if (staticSearchRequest) {
      return staticSearchRequest;
    }

    const filter = match([searchRequest?.filter, mediaSource, library])
      .returnType<SearchFilter | null>()
      .with([P.select(P.nonNullable), P._, P._], (filter) => filter)
      .with([P._, { mediaType: P.select(P.nonNullable) }, P.nullish], (typ) =>
        typeFilter(typ),
      )
      .with([P._, P._, P.select(P.nonNullable)], ({ mediaType }) =>
        typeFilter(mediaType),
      )
      .otherwise(() => null);

    return {
      query: searchRequest?.query,
      filter,
      restrictSearchTo: searchRequest?.restrictSearchTo,
    };
  }, [
    currentParentContext,
    library,
    mediaSource,
    searchRequest?.filter,
    searchRequest?.query,
    searchRequest?.restrictSearchTo,
    staticSearchRequest,
  ]);

  const search = useInfiniteQuery({
    queryKey: ['programs', 'search', query, mediaSource?.id, library?.id],
    queryFn: async ({ pageParam }) => {
      const { data } = await postApiProgramsSearch({
        body: {
          mediaSourceId: mediaSource?.id,
          libraryId: library?.id,
          query: query,
          limit: 45,
          page: pageParam,
        },
        throwOnError: true,
      });
      return data;
    },
    getNextPageParam: (last) => {
      const isFreeQuery = isNonEmptyString(query.query);
      const nextPage = last.page + 1;

      if (isFreeQuery) {
        // We can't always trust the total hits. Meilisearch
        // by default maxes out at 1000 for search requests.
        // You can configure this but it makes search slow. We
        // just keep querying until there are no more results!
        if (last.totalHits < 1_000 && nextPage > last.totalPages) {
          return;
        } else if (last.totalHits >= 1_000 && last.results.length === 0) {
          return;
        }
      } else if (last.results.length === 0) {
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
    initialPageParam: undefined as Maybe<number>,
    staleTime: 0,
  });

  useEffect(() => {
    const allResults = search.data?.pages.flatMap((page) => {
      return page.results;
    });

    if (!isEmpty(allResults)) {
      const byMediaSourceId = groupBy(
        allResults,
        (result) => result.mediaSourceId,
      );
      for (const [mediaSourceId, results] of Object.entries(byMediaSourceId)) {
        addKnownMediaForServer(mediaSourceId, results);
      }
    }
  }, [search.data?.pages]);

  const renderGridItem = (gridItemProps: GridItemProps<ProgramOrFolder>) => {
    return (
      <ProgramGridItem
        key={gridItemProps.item.uuid}
        disableSelection={disableProgramSelection}
        persisted
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
          mediaSource={mediaSource}
          library={library}
          disableProgramSelection={disableProgramSelection}
        />
      );
    },
    [mediaSource, library, disableProgramSelection],
  );

  const totalHits = search.data?.pages?.[0].totalHits;

  return (
    <Box sx={{ mt: 1 }}>
      {depth === 0 && !isUndefined(totalHits) && (
        <Typography textAlign="right" variant="subtitle2">
          Total hits:{' '}
          {isNonEmptyString(query.query) && totalHits >= 1000
            ? '>1000'
            : totalHits}
        </Typography>
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
