import { Box } from '@mui/material';
import { seq } from '@tunarr/shared/util';
import type { PlexFilter } from '@tunarr/types/api';
import { type PlexMedia } from '@tunarr/types/plex';
import { usePrevious } from '@uidotdev/usehooks';
import { flatten, isNull, isUndefined, last, map, range } from 'lodash-es';
import { useCallback, useEffect, useRef, useState } from 'react';
import { match, P } from 'ts-pattern';
import { useDebounceCallback, useResizeObserver } from 'usehooks-ts';
import {
  estimateNumberOfColumns,
  isNonEmptyString,
} from '../../../helpers/util.ts';
import { usePlexCollectionsInfinite } from '../../../hooks/plex/usePlexCollections.ts';
import { usePlexPlaylistsInfinite } from '../../../hooks/plex/usePlexPlaylists.ts';
import { usePlexItemsInfinite } from '../../../hooks/plex/usePlexSearch.ts';
import useStore from '../../../store/index.ts';
import {
  addKnownMediaForPlexServer,
  setPlexFilter,
} from '../../../store/programmingSelector/actions.ts';
import {
  useCurrentMediaSource,
  useCurrentMediaSourceView,
} from '../../../store/programmingSelector/selectors.ts';
import type { Size } from '../../../types/util.ts';
import type { NestedGridProps } from '../MediaItemGrid.tsx';
import { MediaItemGrid, type GridItemProps } from '../MediaItemGrid.tsx';
import { PlexGridItem } from './PlexGridItem.tsx';

type Props = {
  parentContext: PlexMedia[];
  depth?: number;
};

export const RowsToLoad = 3;

export const PlexProgrammingGridView = ({
  parentContext,
  depth = 0,
}: Props) => {
  const selectedServer = useCurrentMediaSource('plex');
  const selectedLibrary = useCurrentMediaSourceView('plex');
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
  const subview =
    selectedLibrary?.view.type === 'library'
      ? selectedLibrary?.view.subview
      : undefined;

  const plexSearchQuery = usePlexItemsInfinite(
    selectedServer,
    selectedLibrary?.view.type === 'library' ? selectedLibrary.view : null,
    searchKey,
    // Should we do this?
    // depth === 0 ? columns * RowsToLoad + bufferSize : 100_000,
    columns * RowsToLoad + bufferSize * (depth === 0 ? 1 : 2),
    currentParentContext
      ? {
          parentId: currentParentContext.ratingKey,
          type: currentParentContext.type,
        }
      : undefined,
  );

  const { data: searchData, isFetchingNextPage: isFetchingNextLibraryPage } =
    plexSearchQuery;

  const plexCollectionsQuery = usePlexCollectionsInfinite(
    selectedServer,
    selectedLibrary?.view.type === 'library' ? selectedLibrary.view : null,
    columns * RowsToLoad + bufferSize,
    subview === 'collections',
  );

  const {
    data: collectionsData,
    isFetchingNextPage: isFetchingNextCollectionPage,
  } = plexCollectionsQuery;

  const plexPlaylistsQuery = usePlexPlaylistsInfinite(
    selectedServer,
    selectedLibrary?.view.type === 'library' ? selectedLibrary.view : null,
    columns * RowsToLoad + bufferSize,
    // selectedLibrary?.view.type === 'library',
    subview === 'playlists',
  );

  const { isFetchingNextPage: isFetchingNextPlaylistPage } = plexPlaylistsQuery;

  // Update store
  useEffect(() => {
    if (!isUndefined(searchData)) {
      // We probably wouldn't have made it this far if we didnt have a server, but
      // putting this here to prevent crashes
      if (selectedServer) {
        const allMedia = flatten(
          seq.collect(searchData.pages, (page) => {
            if (page.size === 0) {
              return;
            }
            return page.Metadata;
          }),
        );
        addKnownMediaForPlexServer(selectedServer.id, allMedia);
      }
    }
  }, [selectedServer, searchData]);

  // Update store
  useEffect(() => {
    if (isNonEmptyString(selectedServer?.id) && !isUndefined(collectionsData)) {
      const allCollections = flatten(
        seq.collect(collectionsData.pages, (page) => {
          if (page.size === 0) {
            return;
          }
          return page.Metadata;
        }),
      );
      addKnownMediaForPlexServer(selectedServer.id, allCollections);
    }
  }, [selectedServer?.id, collectionsData]);

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
      searchData?.pages[searchData?.pages.length - 1].size;

    // Calculate total number of fetched items so far
    const currentTotalSize =
      searchData?.pages.reduce((acc, page) => acc + page.size, 0) || 0;

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
        selectedLibrary.view.library.type === 'show'
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

  const getPlexItemKey = useCallback((item: PlexMedia) => item.guid, []);

  const renderGridItem2 = useCallback((props: GridItemProps<PlexMedia>) => {
    return <PlexGridItem {...props} />;
  }, []);

  const renderNestedGrid = useCallback(
    ({ parent, depth }: NestedGridProps<PlexMedia>) => {
      return (
        <PlexProgrammingGridView
          parentContext={parent ? [parent] : []}
          depth={depth}
        />
      );
    },
    [],
  );

  const getPageDataSize = useCallback(
    (data: { totalSize?: number; size: number }) => {
      return {
        total: data.totalSize,
        size: data.size,
      };
    },
    [],
  );

  const query = currentParentContext
    ? plexSearchQuery
    : match(subview)
        .with('collections', () => plexCollectionsQuery)
        .with('playlists', () => plexPlaylistsQuery)
        .with(P.nullish, () => plexSearchQuery)
        .exhaustive();

  return (
    <Box ref={itemContainer}>
      <MediaItemGrid
        getPageDataSize={getPageDataSize}
        extractItems={(page) => page.Metadata ?? []}
        getItemKey={getPlexItemKey}
        renderGridItem={renderGridItem2}
        depth={depth}
        infiniteQuery={query}
        renderNestedGrid={renderNestedGrid}
        showAlphabetFilter
        handleAlphaNumFilter={filterByFirstLetter}
      />
    </Box>
  );
};
