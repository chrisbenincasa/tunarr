import { getPlexMediaChildType } from '@/helpers/plexUtil.ts';
import { usePlexCollectionsInfinite } from '@/hooks/plex/usePlexCollections.ts';
import { usePlexPlaylistsInfinite } from '@/hooks/plex/usePlexPlaylists.ts';
import { usePlexItemsInfinite } from '@/hooks/plex/usePlexSearch.ts';
import {
  useCurrentMediaSource,
  useCurrentMediaSourceView,
} from '@/store/programmingSelector/selectors.ts';
import { PlexMediaSourceLibraryViewType } from '@/store/programmingSelector/store.ts';
import { Album, Folder, Home, Mic, Tv } from '@mui/icons-material';
import FilterAlt from '@mui/icons-material/FilterAlt';
import {
  Box,
  Breadcrumbs,
  Collapse,
  Grow,
  LinearProgress,
  Link,
  Stack,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from '@mui/material';
import { tag } from '@tunarr/types';
import { PlexFilter } from '@tunarr/types/api';
import {
  PlexChildListing,
  PlexMedia,
  isPlexParentItem,
} from '@tunarr/types/plex';
import { MediaSourceId } from '@tunarr/types/schemas';
import { usePrevious } from '@uidotdev/usehooks';
import {
  chain,
  filter,
  find,
  first,
  isEmpty,
  isNil,
  isNull,
  isUndefined,
  last,
  map,
  range,
  slice,
  sumBy,
} from 'lodash-es';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { P, match } from 'ts-pattern';
import { useDebounceCallback, useResizeObserver, useToggle } from 'usehooks-ts';
import {
  estimateNumberOfColumns,
  isNonEmptyString,
  toggle,
} from '../../helpers/util.ts';
import { usePlexLibraries } from '../../hooks/plex/usePlex.ts';
import { useMediaSources } from '../../hooks/settingsHooks.ts';
import useStore from '../../store/index.ts';
import {
  addKnownMediaForPlexServer,
  setPlexFilter,
} from '../../store/programmingSelector/actions.ts';
import { InlineModal } from '../InlineModal.tsx';
import { TabPanel } from '../TabPanel.tsx';
import { ProgramViewToggleButton } from '../base/ProgramViewToggleButton.tsx';
import StandaloneToggleButton from '../base/StandaloneToggleButton.tsx';
import ConnectMediaSources from '../settings/ConnectMediaSources.tsx';
import {
  GridInlineModalProps,
  GridItemProps,
  MediaItemGrid,
} from './MediaItemGrid.tsx';
import { PlexFilterBuilder } from './PlexFilterBuilder.tsx';
import { PlexGridItem } from './PlexGridItem.tsx';
import { PlexListItem } from './PlexListItem.tsx';
import { PlexSortField } from './PlexSortField.tsx';

function a11yProps(index: number) {
  return {
    id: `plex-programming-tab-${index}`,
    'aria-controls': `plex-programming-tabpanel-${index}`,
  };
}

enum TabValues {
  Library = 0,
  Collections = 1,
  Playlists = 2,
}

type Size = {
  width?: number;
  height?: number;
};

export default function PlexProgrammingSelector() {
  const { data: mediaSources } = useMediaSources();
  const plexServers = filter(mediaSources, { type: 'plex' });
  const selectedServer = useCurrentMediaSource('plex');
  const selectedLibrary = useCurrentMediaSourceView('plex');
  const [tabValue, setTabValue] = useState(TabValues.Library);
  const [scrollParams, setScrollParams] = useState({ limit: 0, max: -1 });
  const [searchVisible, toggleSearchVisible] = useToggle();
  const [useAdvancedSearch, setUseAdvancedSearch] = useState(false);
  const isListView = useStore(
    (s) => s.theme.programmingSelectorView === 'list',
  );
  const [parentContext, setParentContext] = useState<PlexMedia[]>([]);

  const handleChange = (_: React.SyntheticEvent, newValue: TabValues) => {
    setTabValue(newValue);
    clearParentContext();
  };

  const itemContainer = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(8);
  const [bufferSize, setBufferSize] = useState(0);

  const [{ width }, setSize] = useState<Size>({
    width: undefined,
    height: undefined,
  });

  const { data: directoryChildren } = usePlexLibraries(
    selectedServer?.id ?? tag<MediaSourceId>(''),
    selectedServer?.type === 'plex',
  );

  const onResize = useDebounceCallback(setSize, 200);

  useResizeObserver({
    ref: itemContainer,
    onResize,
  });

  const { urlFilter: searchKey } = useStore(({ plexSearch }) => plexSearch);

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

  const plexCollectionsQuery = usePlexCollectionsInfinite(
    selectedServer,
    selectedLibrary?.view.type === 'library' ? selectedLibrary.view : null,
    columns * 5 + bufferSize,
    selectedLibrary?.view.type === 'library',
  );

  const {
    isLoading: isCollectionLoading,
    data: collectionsData,
    isFetchingNextPage: isFetchingNextCollectionPage,
  } = plexCollectionsQuery;

  const plexPlaylistsQuery = usePlexPlaylistsInfinite(
    selectedServer,
    selectedLibrary?.view.type === 'library' ? selectedLibrary.view : null,
    columns * 5 + bufferSize,
    // selectedLibrary?.view.type === 'library',
  );

  const {
    isLoading: isPlaylistLoading,
    data: playlistData,
    isFetchingNextPage: isFetchingNextPlaylistPage,
  } = plexPlaylistsQuery;

  const currentParentContext = last(parentContext);
  const plexSearchQuery = usePlexItemsInfinite(
    selectedServer,
    selectedLibrary?.view.type === 'library' ? selectedLibrary.view : null,
    searchKey,
    columns * 5 + bufferSize,
    currentParentContext
      ? {
          parentId: currentParentContext.ratingKey,
          type: currentParentContext.type,
        }
      : undefined,
  );

  const {
    isLoading: searchLoading,
    data: searchData,
    isFetchingNextPage: isFetchingNextLibraryPage,
  } = plexSearchQuery;

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

  useEffect(() => {
    // When switching between Libraries, if a collection doesn't exist switch back to 'Library' tab
    if (
      tabValue === TabValues.Playlists &&
      isUndefined(playlistData) &&
      !isPlaylistLoading
    ) {
      setTabValue(TabValues.Library);
    } else if (
      tabValue === TabValues.Collections &&
      isUndefined(collectionsData) &&
      !isCollectionLoading
    ) {
      setTabValue(TabValues.Library);
    }
    clearParentContext();
  }, [
    collectionsData,
    isCollectionLoading,
    isPlaylistLoading,
    playlistData,
    tabValue,
  ]);

  useEffect(() => {
    if (searchData?.pages.length === 1) {
      const size = searchData.pages[0].totalSize ?? searchData.pages[0].size;
      if (scrollParams.max !== size) {
        setScrollParams(({ limit }) => ({
          limit,
          max: size,
        }));
      }
    }
  }, [searchData?.pages, scrollParams.max]);

  useEffect(() => {
    if (!isUndefined(searchData)) {
      // We probably wouldn't have made it this far if we didnt have a server, but
      // putting this here to prevent crashes
      if (selectedServer) {
        const allMedia = chain(searchData.pages)
          .reject((page) => page.size === 0)
          .map((page) => page.Metadata)
          .flatten()
          .value();
        addKnownMediaForPlexServer(selectedServer.id, allMedia);
      }
    }
  }, [scrollParams, selectedServer, searchData]);

  useEffect(() => {
    if (isNonEmptyString(selectedServer?.id) && !isUndefined(collectionsData)) {
      const allCollections = chain(collectionsData.pages)
        .reject((page) => page.size === 0)
        .map((page) => page.Metadata)
        .compact()
        .flatten()
        .value();
      addKnownMediaForPlexServer(selectedServer.id, allCollections);
    }
  }, [selectedServer?.id, collectionsData]);

  const totalItems = useMemo(() => {
    switch (tabValue) {
      case TabValues.Library: {
        if (
          selectedLibrary?.view.type ===
          PlexMediaSourceLibraryViewType.Playlists
        ) {
          return (
            find(playlistData?.pages, (p) => !isNil(p.totalSize))?.totalSize ??
            0
          );
        }
        return first(plexSearchQuery.data?.pages)?.totalSize ?? 0;
      }
      case TabValues.Collections:
        return first(collectionsData?.pages)?.totalSize ?? 0;
      case TabValues.Playlists:
        return first(playlistData?.pages)?.totalSize ?? 0;
    }
  }, [
    collectionsData?.pages,
    playlistData?.pages,
    plexSearchQuery.data?.pages,
    selectedLibrary?.view.type,
    tabValue,
  ]);

  const getPlexItemKey = useCallback((item: PlexMedia) => item.guid, []);

  const renderGridItem = (
    gridItemProps: GridItemProps<PlexMedia>,
    modalProps: GridInlineModalProps<PlexMedia>,
  ) => {
    const isLast = gridItemProps.index === totalItems - 1;

    const renderModal =
      isPlexParentItem(gridItemProps.item) &&
      ((gridItemProps.index + 1) % modalProps.rowSize === 0 || isLast);

    return (
      <React.Fragment key={gridItemProps.item.guid}>
        <PlexGridItem {...gridItemProps} />
        {renderModal && (
          <InlineModal
            {...modalProps}
            extractItemId={(item) => item.guid}
            sourceType="plex"
            getItemType={(item) => item.type}
            getChildItemType={(item) => getPlexMediaChildType(item) ?? 'season'}
          />
        )}
      </React.Fragment>
    );
  };

  const renderPanels = () => {
    const elements: JSX.Element[] = [];

    if ((first(collectionsData?.pages)?.size ?? 0) > 0) {
      elements.push(
        <TabPanel
          index={TabValues.Collections}
          value={tabValue}
          key="Collections"
        >
          <MediaItemGrid
            getPageDataSize={(page) => ({
              total: page.totalSize,
              size: page.size,
            })}
            extractItems={(page) => page.Metadata ?? []}
            getItemKey={getPlexItemKey}
            renderGridItem={renderGridItem}
            renderListItem={({ item }) => (
              <PlexListItem
                key={item.guid}
                item={item}
                onPushParent={pushParentContext}
              />
            )}
            infiniteQuery={
              currentParentContext ? plexSearchQuery : plexCollectionsQuery
            }
          />
        </TabPanel>,
      );

      if (
        // tabValue === TabValues.Collections &&
        (first(playlistData?.pages)?.size ?? 0) > 0
      ) {
        elements.push(
          <TabPanel
            index={TabValues.Playlists}
            value={tabValue}
            key="Playlists"
          >
            <MediaItemGrid<PlexChildListing, PlexMedia>
              getPageDataSize={(page) => ({
                total: page.totalSize,
                size: page.size,
              })}
              extractItems={(page) => page.Metadata ?? []}
              getItemKey={getPlexItemKey}
              renderGridItem={renderGridItem}
              renderListItem={({ item }) => (
                <PlexListItem
                  key={item.guid}
                  item={item}
                  onPushParent={pushParentContext}
                />
              )}
              infiniteQuery={
                currentParentContext ? plexSearchQuery : plexPlaylistsQuery
              }
            />
          </TabPanel>,
        );
      }
    }

    return elements;
  };

  const pushParentContext = useCallback((item: PlexMedia) => {
    setParentContext((prev) => {
      if (last(prev)?.guid !== item.guid) {
        return [...prev, item];
      } else {
        return prev;
      }
    });
  }, []);

  const clearParentContext = () => {
    setParentContext([]);
  };

  const popParentContextToIndex = (idx: number) => {
    setParentContext((prev) => slice(prev, 0, idx + 1));
  };

  const renderContextBreadcrumbs = () => {
    const contextLinks = map(parentContext, (item, idx) => {
      const isLast = idx === parentContext.length - 1;
      const icon = match(item.type)
        .with('show', () => <Tv sx={{ mr: 0.5 }} fontSize="inherit" />)
        .with('artist', () => <Mic sx={{ mr: 0.5 }} fontSize="inherit" />)
        .with('album', () => <Album sx={{ mr: 0.5 }} fontSize="inherit" />)
        .with(P.union('collection', 'playlist'), () => (
          <Folder sx={{ mr: 0.5 }} fontSize="inherit" />
        ))
        .otherwise(() => null);
      return (
        <Link
          underline={isLast ? 'none' : 'hover'}
          color={isLast ? 'text.primary' : 'inherit'}
          sx={{
            cursor: isLast ? undefined : 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
          key={item.guid}
          onClick={() => (isLast ? () => {} : popParentContextToIndex(idx))}
        >
          {icon}
          {item.title}
        </Link>
      );
    });
    return (
      <Breadcrumbs maxItems={4}>
        <Link
          underline="hover"
          sx={{
            cursor: isEmpty(parentContext) ? undefined : 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
          color={isEmpty(parentContext) ? 'text.primary' : 'inherit'}
          onClick={clearParentContext}
        >
          <Home sx={{ mr: 0.5 }} fontSize="inherit" />
          Root
        </Link>
        {contextLinks}
      </Breadcrumbs>
    );
  };

  return (
    <>
      {!isNil(directoryChildren) &&
        directoryChildren.size > 0 &&
        selectedLibrary && (
          <Box sx={{ mt: 1 }}>
            {selectedLibrary.view.type !==
              PlexMediaSourceLibraryViewType.Playlists && (
              <>
                <Stack direction="row" gap={1} sx={{ mt: 2 }}>
                  <StandaloneToggleButton
                    selected={searchVisible}
                    onToggle={() => {
                      toggleSearchVisible();
                      setPlexFilter(undefined);
                    }}
                    toggleButtonProps={{
                      size: 'small',
                      sx: { mr: 1 },
                      color: 'primary',
                    }}
                  >
                    <FilterAlt />
                  </StandaloneToggleButton>
                  {searchVisible && (
                    <Grow in={searchVisible}>
                      <ToggleButtonGroup
                        size="small"
                        color="primary"
                        exclusive
                        value={useAdvancedSearch ? 'advanced' : 'basic'}
                        onChange={() => setUseAdvancedSearch(toggle)}
                      >
                        <ToggleButton value="basic">Basic</ToggleButton>
                        <ToggleButton value="advanced">Advanced</ToggleButton>
                      </ToggleButtonGroup>
                    </Grow>
                  )}

                  <PlexSortField />
                </Stack>
                <Collapse in={searchVisible} mountOnEnter>
                  <Box sx={{ py: 1 }}>
                    <PlexFilterBuilder advanced={useAdvancedSearch} />
                  </Box>
                </Collapse>
              </>
            )}

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              sx={{
                display: 'flex',
                pt: 1,
                columnGap: 1,
                alignItems: 'flex-end',
                justifyContent: 'flex-end',
                flexGrow: 1,
              }}
            >
              <ProgramViewToggleButton />
            </Stack>
          </Box>
        )}
      {plexServers?.length === 0 ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            m: 4,
          }}
        >
          <ConnectMediaSources />
        </Box>
      ) : (
        <>
          <LinearProgress
            sx={{
              visibility: searchLoading ? 'visible' : 'hidden',
              height: 10,
              marginTop: 1,
            }}
          />
          {isListView && renderContextBreadcrumbs()}
          <Box
            sx={{
              borderBottom: 1,
              borderColor: 'divider',
            }}
            ref={itemContainer}
          >
            <Tabs
              value={tabValue}
              onChange={handleChange}
              aria-label="Plex media selector tabs"
              variant="scrollable"
              allowScrollButtonsMobile
            >
              <Tab
                value={TabValues.Library}
                label="Library"
                {...a11yProps(TabValues.Library)}
              />
              {selectedLibrary?.view.type !==
                PlexMediaSourceLibraryViewType.Playlists && (
                <Tab
                  value={TabValues.Collections}
                  label="Collections"
                  disabled={
                    sumBy(collectionsData?.pages, (page) => page.size) === 0 ||
                    isCollectionLoading
                  }
                  {...a11yProps(TabValues.Collections)}
                />
              )}
              {selectedLibrary?.view.type !==
                PlexMediaSourceLibraryViewType.Playlists && (
                <Tab
                  value={TabValues.Playlists}
                  label={
                    <Tooltip
                      title={
                        sumBy(playlistData?.pages, 'size') === 0 ||
                        isPlaylistLoading
                          ? 'Selected library has no playlists'
                          : null
                      }
                      placement="top"
                      arrow
                    >
                      <span>Playlists</span>
                    </Tooltip>
                  }
                  sx={{
                    '&.Mui-disabled': {
                      pointerEvents: 'all',
                    },
                  }}
                  disabled={
                    sumBy(playlistData?.pages, 'size') === 0 ||
                    isPlaylistLoading
                  }
                  {...a11yProps(TabValues.Playlists)}
                />
              )}
            </Tabs>
          </Box>
          <TabPanel index={TabValues.Library} value={tabValue} key="Library">
            <MediaItemGrid
              getPageDataSize={(page) => ({
                total: page.totalSize,
                size: page.size,
              })}
              extractItems={(page) => page.Metadata}
              getItemKey={getPlexItemKey}
              renderGridItem={renderGridItem}
              renderListItem={({ item, style }) => (
                <PlexListItem
                  key={item.guid}
                  item={item}
                  style={style}
                  onPushParent={pushParentContext}
                />
              )}
              infiniteQuery={
                selectedLibrary?.view.type ===
                PlexMediaSourceLibraryViewType.Playlists
                  ? plexPlaylistsQuery
                  : plexSearchQuery
              }
              showAlphabetFilter={!searchVisible}
              handleAlphaNumFilter={filterByFirstLetter}
            />
          </TabPanel>
          {renderPanels()}
        </>
      )}
    </>
  );
}
