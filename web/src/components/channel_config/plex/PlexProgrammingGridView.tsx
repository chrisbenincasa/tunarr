import { Box } from '@mui/material';
import type {
  InfiniteData,
  UseInfiniteQueryResult,
} from '@tanstack/react-query';
import type { ProgramOrFolder } from '@tunarr/types';
import type { PagedResult, PlexFilter } from '@tunarr/types/api';
import { usePrevious } from '@uidotdev/usehooks';
import { isNull, last, map, range } from 'lodash-es';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { match, P } from 'ts-pattern';
import { useDebounceCallback, useResizeObserver } from 'usehooks-ts';
import { Plex } from '../../../helpers/constants.ts';
import { estimateNumberOfColumns } from '../../../helpers/util.ts';
import { usePlexCollectionsInfinite } from '../../../hooks/plex/usePlexCollections.ts';
import {
  usePlexPlaylistsInfinite,
  usePlexTopLevelPlaylistsInfinite,
} from '../../../hooks/plex/usePlexPlaylists.ts';
import { usePlexItemsInfinite } from '../../../hooks/plex/usePlexSearch.ts';
import useStore from '../../../store/index.ts';
import { setPlexFilter } from '../../../store/programmingSelector/actions.ts';
import {
  useCurrentMediaSource,
  useCurrentMediaSourceView,
} from '../../../store/programmingSelector/selectors.ts';
import type { Size } from '../../../types/util.ts';
import { ProgramGridItem } from '../../library/ProgramGridItem.tsx';
import type { NestedGridProps } from '../MediaItemGrid.tsx';
import { MediaItemGrid, type GridItemProps } from '../MediaItemGrid.tsx';

type Props = {
  parentContext: ProgramOrFolder[];
  depth?: number;
};

export const RowsToLoad = 3;

export const PlexProgrammingGridView = ({
  parentContext,
  depth = 0,
}: Props) => {
  const selectedServer = useCurrentMediaSource(Plex);
  const selectedLibrary = useCurrentMediaSourceView(Plex);
  const { urlFilter: searchKey } = useStore(({ plexSearch }) => plexSearch);
  const [columns, setColumns] = useState(8);
  const [bufferSize, setBufferSize] = useState(0);
  const itemContainer = useRef<HTMLDivElement>(null);
  const [{ width }, setSize] = useState<Size>({
    width: undefined,
    height: undefined,
  });

  const onResize = useDebounceCallback(setSize, 200);

  useResizeObserver({
    ref: itemContainer,
    onResize,
  });

  const currentParentContext = last(parentContext);
  const subview = useMemo(
    () =>
      selectedLibrary?.view.type === 'library'
        ? selectedLibrary?.view.subview
        : undefined,
    [selectedLibrary?.view],
  );
  console.log(subview, selectedLibrary?.view.type);

  const plexSearchQuery = usePlexItemsInfinite(
    selectedServer,
    selectedLibrary?.view.type === 'library' ? selectedLibrary.view : null,
    searchKey,
    // Should we do this?
    // depth === 0 ? columns * RowsToLoad + bufferSize : 100_000,
    columns * RowsToLoad + bufferSize * (depth === 0 ? 1 : 2),
    currentParentContext
      ? {
          parentId: currentParentContext.externalId,
          type: currentParentContext.type,
        }
      : undefined,
    (!subview && selectedLibrary?.view.type !== 'playlists') ||
      !!currentParentContext,
  );

  const { data: searchData, isFetchingNextPage: isFetchingNextLibraryPage } =
    plexSearchQuery;

  const plexCollectionsQuery = usePlexCollectionsInfinite(
    selectedServer,
    selectedLibrary?.view.type === 'library' ? selectedLibrary.view : null,
    columns * RowsToLoad + bufferSize,
    subview === 'collections' && !currentParentContext,
  );

  const { isFetchingNextPage: isFetchingNextCollectionPage } =
    plexCollectionsQuery;

  const plexPlaylistsQuery = usePlexPlaylistsInfinite(
    selectedServer,
    selectedLibrary?.view.type === 'library' ? selectedLibrary.view : null,
    columns * RowsToLoad + bufferSize,
    subview === 'playlists' && !currentParentContext,
  );

  const { isFetchingNextPage: isFetchingNextPlaylistPage } = plexPlaylistsQuery;

  const plexToplevelPlaylistsQuery = usePlexTopLevelPlaylistsInfinite(
    selectedServer,
    columns * RowsToLoad + bufferSize,
    selectedLibrary?.view.type === 'playlists',
  );

  const previousIsFetchingNextLibraryPage = usePrevious(
    isFetchingNextLibraryPage,
  );

  const previousIsFetchingNextCollectionPage = usePrevious(
    isFetchingNextCollectionPage,
  );

  const previousIsFetchingNextPlaylistPage = usePrevious(
    isFetchingNextPlaylistPage,
  );

  // reset bufferSize after each fetch
  // we only need a buffer size to fill the gap between two fetches
  useEffect(() => {
    if (
      (previousIsFetchingNextLibraryPage && !isFetchingNextLibraryPage) ||
      (previousIsFetchingNextCollectionPage && !isFetchingNextCollectionPage) ||
      (previousIsFetchingNextPlaylistPage && !isFetchingNextPlaylistPage)
    ) {
      setBufferSize(0);
    }
  }, [
    previousIsFetchingNextLibraryPage,
    previousIsFetchingNextCollectionPage,
    previousIsFetchingNextPlaylistPage,
    isFetchingNextLibraryPage,
    isFetchingNextCollectionPage,
    isFetchingNextPlaylistPage,
  ]);

  useEffect(() => {
    const containerWidth =
      itemContainer?.current?.getBoundingClientRect().width || 0;
    const padding = 16; // to do: don't hardcode this
    // We have to estimate the number of columns because the items aren't loaded yet to use their width to calculate it
    const numberOfColumns = estimateNumberOfColumns(containerWidth + padding);
    const prevNumberOfColumns =
      searchData?.pages[searchData?.pages.length - 1].result.length;

    // Calculate total number of fetched items so far
    const currentTotalSize =
      searchData?.pages.reduce((acc, page) => acc + page.result.length, 0) || 0;

    // Calculate total items that don't fill an entire row
    const leftOvers = currentTotalSize % numberOfColumns;

    // Calculate total items that are needed to fill the remainder of the row
    const bufferSize = numberOfColumns - leftOvers;

    if (prevNumberOfColumns !== numberOfColumns && prevNumberOfColumns) {
      setBufferSize(bufferSize);
    }

    setColumns(numberOfColumns);
  }, [itemContainer, searchData?.pages, width]);

  const filterByFirstLetter = useCallback(
    (letter: string | null) => {
      if (isNull(letter)) {
        setPlexFilter(undefined);
        return;
      }

      const field =
        selectedLibrary?.view.type === 'library' &&
        selectedLibrary.view.library.childType === 'show'
          ? 'show.title'
          : 'title';

      let filter: PlexFilter;
      if (letter === '#') {
        filter = {
          // field,
          type: 'op',
          op: 'or',
          children: map(
            range('0'.charCodeAt(0), '9'.charCodeAt(0) + 1),
            (code) => ({
              field,
              type: 'value',
              op: '<=',
              value: String.fromCharCode(code),
            }),
          ),
        };
      } else {
        filter = {
          field,
          type: 'value',
          op: '<=',
          value: letter.toUpperCase(),
        };
      }

      setPlexFilter(filter);
    },
    [selectedLibrary?.view],
  );

  const getPlexItemKey = useCallback((item: ProgramOrFolder) => item.uuid, []);

  const renderGridItem = useCallback(
    (props: GridItemProps<ProgramOrFolder>) => {
      return <ProgramGridItem {...props} />;
    },
    [],
  );

  const renderNestedGrid = useCallback(
    ({ parent, depth }: NestedGridProps<ProgramOrFolder>) => {
      return (
        <PlexProgrammingGridView
          parentContext={parent ? [parent] : []}
          depth={depth}
        />
      );
    },
    [],
  );

  const query: UseInfiniteQueryResult<
    InfiniteData<PagedResult<ProgramOrFolder[]>>
  > = currentParentContext
    ? plexSearchQuery
    : match([subview, selectedLibrary?.view.type])
        .returnType<
          UseInfiniteQueryResult<InfiniteData<PagedResult<ProgramOrFolder[]>>>
        >()
        .with(['collections', P._], () => plexCollectionsQuery)
        .with(['playlists', P._], () => plexPlaylistsQuery)
        .with([P._, 'playlists'], () => plexToplevelPlaylistsQuery)
        .with([P.nullish, P._], () => plexSearchQuery)
        .exhaustive();

  return (
    <Box ref={itemContainer}>
      <MediaItemGrid
        getPageDataSize={useCallback(
          (res: PagedResult<ProgramOrFolder[]>) => ({
            size: res.size,
            total: res.total,
          }),
          [],
        )}
        extractItems={(page) => page.result}
        getItemKey={getPlexItemKey}
        renderGridItem={renderGridItem}
        depth={depth}
        infiniteQuery={query}
        renderNestedGrid={renderNestedGrid}
        showAlphabetFilter
        handleAlphaNumFilter={filterByFirstLetter}
      />
    </Box>
  );
};
