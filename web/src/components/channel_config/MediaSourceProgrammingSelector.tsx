import useStore from '@/store';
import {
  Box,
  Divider,
  LinearProgress,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import {
  InfiniteData,
  QueryKey,
  QueryState,
  useQueryClient,
} from '@tanstack/react-query';
import { MediaSourceSettings } from '@tunarr/types';
import {
  PlexMovie,
  PlexTvShow,
  PlexMusicArtist,
  PlexMedia,
  isPlexParentItem,
} from '@tunarr/types/plex';
import { chain, first, has, map, sumBy } from 'lodash-es';
import { useMemo, useRef, useState } from 'react';
import {
  useDebounceCallback,
  useIntersectionObserver,
  useResizeObserver,
} from 'usehooks-ts';
import GridContainerTabPanel from '../GridContainerTabPanel';
import { PlexListItem } from './PlexListItem';
import { findFirstItemInNextRowIndex } from '@/helpers/inlineModalUtil';
import React from 'react';
import { InlineModal } from '../InlineModal';
import { PlexGridItem } from './PlexGridItem';

type Size = {
  width?: number;
  height?: number;
};

type Props = {
  mediaSourceType: MediaSourceSettings['type'];
  // queryKey: QueryKey;
  tabs: number[];
  defaultTab: number;
  queryKeyForTab: Record<number, QueryKey>;
  fetchNextPageOnTab: (tab: number) => void;
};

enum TabValues {
  Library = 0,
}

export function MediaSourceProgrammingSelector({
  queryKeyForTab,
  defaultTab,
  fetchNextPageOnTab,
}: Props) {
  const viewType = useStore((state) => state.theme.programmingSelectorView);
  const queryClient = useQueryClient();
  const [tabValue, setTabValue] = useState(defaultTab);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [rowSize, setRowSize] = useState(9);
  const [modalGuid, setModalGuid] = useState<string>('');
  const [modalIndex, setModalIndex] = useState(-1);
  const [scrollParams, setScrollParams] = useState({ limit: 0, max: -1 });

  const queryState = useMemo(() => {
    const state = queryClient.getQueryState(queryKeyForTab[tabValue]);
    if (state) {
      return has(state, 'pages') && has(state, 'pageParams')
        ? (state as QueryState<InfiniteData<unknown>, Error>)
        : undefined;
    }
    return;
  }, [queryClient, queryKeyForTab, tabValue]);
  const itemsLoading = queryState?.status === 'pending';

  const [{ width }, setSize] = useState<Size>({
    width: undefined,
    height: undefined,
  });

  const onResize = useDebounceCallback(setSize, 200);

  useResizeObserver({
    ref: gridContainerRef,
    onResize,
  });

  const { ref } = useIntersectionObserver({
    onChange: (_, entry) => {
      if (entry.isIntersecting) {
        if (scrollParams.limit < scrollParams.max) {
          setScrollParams(({ limit: prevLimit, max }) => ({
            max,
            limit: prevLimit + rowSize * 4,
          }));
        }

        fetchNextPageOnTab(tabValue);

        // if (
        //   tabValue === TabValues.Library &&
        //   hasNextItemsPage &&
        //   !isFetchingNextItemsPage
        // ) {
        //   fetchNextItemsPage().catch(console.error);
        // }

        // if (
        //   tabValue === TabValues.Collections &&
        //   hasNextCollectionsPage &&
        //   !isFetchingNextCollectionsPage
        // ) {
        //   fetchNextCollectionsPage().catch(console.error);
        // }

        // if (
        //   tabValue === TabValues.Playlists &&
        //   hasNextPlaylistPage &&
        //   !isFetchingNextPlaylistPage
        // ) {
        //   fetchNextPlaylistPage().catch(console.error);
        // }
      }
    },
    threshold: 0.5,
  });

  const firstItemInNextLibraryRowIndex = useMemo(
    () =>
      findFirstItemInNextRowIndex(
        modalIndex,
        rowSize,
        sumBy(queryState?.data?.pages, (p) => p.length) ?? 0,
      ),
    [queryState?.data, rowSize, modalIndex],
  );

  const renderGridItems = (item: PlexMedia, index: number) => {
    const firstItemIndex: number = firstItemInNextLibraryRowIndex;
    // switch (tabValue) {
    //   case TabValues.Library:
    //     firstItemIndex = firstItemInNextLibraryRowIndex;
    //     break;
    //   case TabValues.Collections:
    //     firstItemIndex = firstItemInNextCollectionRowIndex;
    //     break;
    //   case TabValues.Playlists:
    //     firstItemIndex = firstItemInNextPlaylistRowIndex;
    //     break;
    // }

    const isOpen = index === firstItemIndex;

    return (
      <React.Fragment key={item.guid}>
        {isPlexParentItem(item) &&
          (item.type === 'playlist' ? (item.leafCount ?? 0) < 500 : true) && (
            <InlineModal
              itemGuid={modalGuid}
              modalIndex={modalIndex}
              rowSize={rowSize}
              open={isOpen}
              type={item.type}
            />
          )}
        {/* TODO: Consider forking this to a separate component for non-parent items, because
        currently it erroneously creates a lot of tracked queries in react-query that will never be enabled */}
        <PlexGridItem
          item={item}
          index={index}
          modalIndex={modalIndex}
          moveModal={handleMoveModal}
          ref={(element) => (gridImageRefs.current[item.guid] = element)}
        />
      </React.Fragment>
    );
  };

  const renderListItems = () => {
    const elements: JSX.Element[] = [];

    if (queryState?.data && (first(queryState?.data.pages)?.length ?? 0) > 0) {
      const items = chain(queryState?.data.pages)
        .map((page) => page.Metadata)
        .flatten()
        .value();

      const totalSearchDataSize =
        searchData.pages[0].totalSize || searchData.pages[0].size;

      elements.push(
        <GridContainerTabPanel value={tabValue} index={0} key="Library">
          {map(
            items,
            (item: PlexMovie | PlexTvShow | PlexMusicArtist, index: number) =>
              viewType === 'list' ? (
                <PlexListItem key={item.guid} item={item} />
              ) : (
                renderGridItems(item, index)
              ),
          )}

          {/* {items.length >= totalSearchDataSize &&
            renderFinalRowInlineModal(items)} */}
        </GridContainerTabPanel>,
      );
    }
  };

  return (
    <>
      <LinearProgress
        sx={{
          visibility: itemsLoading ? 'visible' : 'hidden',
          height: 10,
          marginTop: 1,
        }}
      />
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={tabValue}
          onChange={(_, newValue: number) => setTabValue(newValue)}
          aria-label="Plex media selector tabs"
          variant="scrollable"
          allowScrollButtonsMobile
        >
          <Tab
            value={TabValues.Library}
            label="Library"
            // {...a11yProps(0)}
          />
          {/* {!isUndefined(collectionsData) &&
                sumBy(collectionsData.pages, (page) => page.size) > 0 && (
                  <Tab
                    value={TabValues.Collections}
                    label="Collections"
                    {...a11yProps(1)}
                  />
                )}
              {!isUndefined(playlistData) &&
                sumBy(playlistData.pages, 'size') > 0 && (
                  <Tab
                    value={TabValues.Playlists}
                    label="Playlists"
                    {...a11yProps(1)}
                  />
                )} */}
        </Tabs>
      </Box>
      <Box ref={gridContainerRef} sx={{ width: '100%' }}>
        {renderListItems()}
      </Box>
      {!itemsLoading && <div style={{ height: 96 }} ref={ref}></div>}
      {/* {isFetchingNextItemsPage && (
            <CircularProgress
              color="primary"
              sx={{ display: 'block', margin: '2em auto' }}
            />
          )} */}
      {queryState?.data /*&& !hasNextItemsPage */ && (
        <Typography fontStyle={'italic'} sx={{ textAlign: 'center' }}>
          fin.
        </Typography>
      )}
      <Divider sx={{ mt: 3, mb: 2 }} />
    </>
  );
}
