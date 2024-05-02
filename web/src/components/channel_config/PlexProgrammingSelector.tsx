import FilterAlt from '@mui/icons-material/FilterAlt';
import GridView from '@mui/icons-material/GridView';
import ViewList from '@mui/icons-material/ViewList';
import {
  Box,
  Collapse,
  Divider,
  Grow,
  LinearProgress,
  Stack,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { DataTag, useInfiniteQuery } from '@tanstack/react-query';
import {
  PlexLibraryCollections,
  PlexLibraryMovies,
  PlexLibraryMusic,
  PlexLibraryShows,
  PlexMedia,
  PlexMovie,
  PlexMusicArtist,
  PlexTvShow,
  isPlexParentItem,
} from '@tunarr/types/plex';
import { usePrevious } from '@uidotdev/usehooks';
import _, {
  chain,
  compact,
  first,
  flatMap,
  forEach,
  isNil,
  isUndefined,
  map,
  sumBy,
} from 'lodash-es';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  useDebounceCallback,
  useIntersectionObserver,
  useResizeObserver,
} from 'usehooks-ts';
import {
  extractLastIndexes,
  findFirstItemInNextRowIndex,
  getImagesPerRow,
  isNewModalAbove,
} from '../../helpers/inlineModalUtil';
import { isNonEmptyString, toggle } from '../../helpers/util';
import { fetchPlexPath, usePlex } from '../../hooks/plexHooks';
import { usePlexServerSettings } from '../../hooks/settingsHooks';
import { useTunarrApi } from '../../hooks/useTunarrApi.ts';
import useStore from '../../store';
import { addKnownMediaForServer } from '../../store/programmingSelector/actions';
import { setProgrammingSelectorViewState } from '../../store/themeEditor/actions';
import { ProgramSelectorViewType } from '../../types';
import { InlineModal } from '../InlineModal';
import CustomTabPanel from '../TabPanel';
import StandaloneToggleButton from '../base/StandaloneToggleButton.tsx';
import ConnectPlex from '../settings/ConnectPlex';
import { PlexFilterBuilder } from './PlexFilterBuilder.tsx';
import { PlexGridItem } from './PlexGridItem';
import { PlexListItem } from './PlexListItem';
import { PlexSortField } from './PlexSortField.tsx';

function a11yProps(index: number) {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  };
}

type RefMap = {
  [k: string]: HTMLDivElement | null;
};

type Size = {
  width?: number;
  height?: number;
};

export default function PlexProgrammingSelector() {
  const apiClient = useTunarrApi();
  const { data: plexServers } = usePlexServerSettings();
  const selectedServer = useStore((s) => s.currentServer);
  const selectedLibrary = useStore((s) =>
    s.currentLibrary?.type === 'plex' ? s.currentLibrary : null,
  );
  const viewType = useStore((state) => state.theme.programmingSelectorView);
  const [tabValue, setTabValue] = useState(0);
  const [rowSize, setRowSize] = useState(16);
  const [modalIndex, setModalIndex] = useState(-1);
  const [modalGuid, setModalGuid] = useState<string>('');
  const [scrollParams, setScrollParams] = useState({ limit: 0, max: -1 });
  const [searchVisible, setSearchVisible] = useState(false);
  const [useAdvancedSearch, setUseAdvancedSearch] = useState(false);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const gridImageRefs = useRef<RefMap>({});
  const previousModalIndex = usePrevious(modalIndex);

  const [{ width }, setSize] = useState<Size>({
    width: undefined,
    height: undefined,
  });

  const onResize = useDebounceCallback(setSize, 200);

  useResizeObserver({
    ref: gridContainerRef,
    onResize,
  });

  useEffect(() => {
    if (viewType === 'grid') {
      let imageRef: HTMLDivElement | null = null;

      if (modalGuid === '') {
        // Grab the first non-null ref for an image
        for (const key in gridImageRefs.current) {
          if (gridImageRefs.current[key] !== null) {
            imageRef = gridImageRefs.current[key];
            break;
          }
        }
      } else {
        imageRef = _.get(gridImageRefs.current, modalGuid);
      }

      const imageWidth = imageRef?.getBoundingClientRect().width;

      // 16 is additional padding available in the parent container
      const rowSize = getImagesPerRow(width ? width + 16 : 0, imageWidth || 0);
      setRowSize(rowSize);
      setScrollParams(({ max }) => ({ max, limit: rowSize * 4 }));
    }
  }, [width, tabValue, viewType, modalGuid]);

  useEffect(() => {
    setTabValue(0);
  }, [selectedLibrary]);

  useEffect(() => {
    setModalIndex(-1);
    setModalGuid('');
  }, [tabValue, selectedLibrary]);

  const handleChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const scrollToGridItem = useCallback(
    (guid: string, index: number) => {
      const selectedElement = gridImageRefs.current[guid];
      const includeModalInHeightCalc = isNewModalAbove(
        previousModalIndex,
        index,
        rowSize,
      );

      if (selectedElement) {
        // magic number for top bar padding; to do: calc it off ref
        const topBarPadding = 64;
        // New modal is opening in a row above previous modal
        const modalMovesUp = selectedElement.offsetTop - topBarPadding;
        // New modal is opening in the same row or a row below the current modal
        const modalMovesDown =
          selectedElement.offsetTop -
          selectedElement.offsetHeight -
          topBarPadding;

        window.scrollTo({
          top: includeModalInHeightCalc ? modalMovesDown : modalMovesUp,
          behavior: 'smooth',
        });
      }
    },
    [previousModalIndex, rowSize],
  );

  // Scroll to new selected item when modalIndex changes
  // Doing this on modalIndex change negates the need to calc inline modal height since it's collapsed at this time
  useEffect(() => {
    scrollToGridItem(modalGuid, modalIndex);
  }, [modalGuid, modalIndex, scrollToGridItem]);

  const handleMoveModal = useCallback(
    (index: number, item: PlexMedia) => {
      if (index === modalIndex) {
        setModalIndex(-1);
        setModalGuid('');
      } else {
        setModalIndex(index);
        setModalGuid(item.guid);
      }
    },
    [modalIndex],
  );

  const { data: directoryChildren } = usePlex(
    selectedServer?.name ?? '',
    '/library/sections',
    !isUndefined(selectedServer),
  );

  const setViewType = (view: ProgramSelectorViewType) => {
    setProgrammingSelectorViewState(view);
  };

  const handleFormat = (
    _event: React.MouseEvent<HTMLElement>,
    newFormats: ProgramSelectorViewType,
  ) => {
    setViewType(newFormats);
  };

  const {
    isLoading: isCollectionLoading,
    data: collectionsData,
    fetchNextPage: fetchNextCollectionsPage,
    isFetchingNextPage: isFetchingNextCollectionsPage,
    hasNextPage: hasNextCollectionsPage,
  } = useInfiniteQuery({
    queryKey: [
      'plex',
      selectedServer?.name,
      selectedLibrary?.library.key,
      'collections',
    ],
    queryFn: ({ pageParam }) => {
      const plexQuery = new URLSearchParams({
        'X-Plex-Container-Start': pageParam.toString(),
        'X-Plex-Container-Size': (rowSize * 4).toString(),
      });

      return fetchPlexPath<PlexLibraryCollections>(
        apiClient,
        selectedServer!.name,
        `/library/sections/${selectedLibrary?.library
          .key}/collections?${plexQuery.toString()}`,
      )();
    },
    enabled: !isNil(selectedServer) && !isNil(selectedLibrary),
    initialPageParam: 0,
    getNextPageParam: (res, all, last) => {
      const total = sumBy(all, (page) => page.size);
      if (total >= (res.totalSize ?? res.size)) {
        return null;
      }

      // Next offset is the last + how many items we got back.
      return last + res.size;
    },
  });

  useEffect(() => {
    // When switching between Libraries, if a collection doesn't exist switch back to 'Library' tab
    if (!collectionsData && !isCollectionLoading && tabValue === 1) {
      setTabValue(0);
    }
  }, [collectionsData, isCollectionLoading, tabValue]);

  const { urlFilter: searchKey } = useStore(
    ({ plexSearch: plexQuery }) => plexQuery,
  );

  const {
    isLoading: searchLoading,
    data: searchData,
    fetchNextPage: fetchNextItemsPage,
    hasNextPage: hasNextItemsPage,
    isFetchingNextPage: isFetchingNextItemsPage,
  } = useInfiniteQuery({
    queryKey: [
      'plex-search',
      selectedServer?.name,
      selectedLibrary?.library.key,
      searchKey,
    ] as DataTag<
      ['plex-search', string, string, string],
      PlexLibraryMovies | PlexLibraryShows | PlexLibraryMusic
    >,
    enabled: !isNil(selectedServer) && !isNil(selectedLibrary),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => {
      const plexQuery = new URLSearchParams({
        'X-Plex-Container-Start': pageParam.toString(),
        'X-Plex-Container-Size': (rowSize * 4).toString(),
      });
      // HACK for now
      forEach(searchKey?.split('&'), (keyval) => {
        const idx = keyval.lastIndexOf('=');
        if (idx !== -1) {
          plexQuery.append(keyval.substring(0, idx), keyval.substring(idx + 1));
        }
      });

      return fetchPlexPath<
        PlexLibraryMovies | PlexLibraryShows | PlexLibraryMusic
      >(
        apiClient,
        selectedServer!.name,
        `/library/sections/${
          selectedLibrary!.library.key
        }/all?${plexQuery.toString()}`,
      )();
    },
    getNextPageParam: (res, all, last) => {
      const total = sumBy(all, (page) => page.size);
      if (total >= (res.totalSize ?? res.size)) {
        return null;
      }

      // Next offset is the last + how many items we got back.
      return last + res.size;
    },
  });

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
        addKnownMediaForServer(selectedServer.name, allMedia);
      }
    }
  }, [scrollParams, selectedServer, searchData, rowSize]);

  useEffect(() => {
    if (
      isNonEmptyString(selectedServer?.name) &&
      !isUndefined(collectionsData)
    ) {
      const allCollections = chain(collectionsData.pages)
        .reject((page) => page.size === 0)
        .map((page) => page.Metadata)
        .compact()
        .flatten()
        .value();
      addKnownMediaForServer(selectedServer.name, allCollections);
    }
  }, [selectedServer?.name, collectionsData]);

  const { ref } = useIntersectionObserver({
    onChange: (_, entry) => {
      if (entry.isIntersecting) {
        if (scrollParams.limit < scrollParams.max) {
          setScrollParams(({ limit: prevLimit, max }) => ({
            max,
            limit: prevLimit + rowSize * 4,
          }));
        }
        if (tabValue === 0 && hasNextItemsPage && !isFetchingNextItemsPage) {
          fetchNextItemsPage().catch(console.error);
        }
        if (
          tabValue === 1 &&
          hasNextCollectionsPage &&
          !isFetchingNextCollectionsPage
        ) {
          fetchNextCollectionsPage().catch(console.error);
        }
      }
    },
    threshold: 0.5,
  });

  const firstItemInNexLibraryRowIndex = useMemo(
    () =>
      findFirstItemInNextRowIndex(
        modalIndex,
        rowSize,
        sumBy(searchData?.pages, (p) => p.size) ?? 0,
      ),
    [searchData, rowSize, modalIndex],
  );

  const firstItemInNextCollectionRowIndex = useMemo(
    () =>
      findFirstItemInNextRowIndex(
        modalIndex,
        rowSize,
        sumBy(collectionsData?.pages, (p) => p.size) ?? 0,
      ),
    [collectionsData, rowSize, modalIndex],
  );

  const renderGridItems = (item: PlexMedia, index: number) => {
    const isOpen =
      index ===
      (tabValue === 0
        ? firstItemInNexLibraryRowIndex
        : firstItemInNextCollectionRowIndex);
    return (
      <React.Fragment key={item.guid}>
        {isPlexParentItem(item) && (
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

  const renderFinalRowInlineModal = (arr: PlexMedia[]) => {
    // /This Modal is for last row items because they can't be inserted using the above inline modal
    return (
      <InlineModal
        itemGuid=""
        modalIndex={modalIndex}
        rowSize={rowSize}
        open={extractLastIndexes(arr, arr.length % rowSize).includes(
          modalIndex,
        )}
        type={'season'}
      />
    );
  };

  const renderListItems = () => {
    const elements: JSX.Element[] = [];

    if (
      collectionsData &&
      (first(collectionsData.pages)?.size ?? 0) > 0 &&
      tabValue === 1
    ) {
      elements.push(
        <CustomTabPanel value={tabValue} index={1} key="Collections">
          {map(
            flatMap(collectionsData.pages, (page) => page.Metadata),
            (item: PlexMovie | PlexTvShow | PlexMusicArtist, index: number) =>
              viewType === 'list' ? (
                <PlexListItem key={item.guid} item={item} />
              ) : (
                renderGridItems(item, index)
              ),
          )}
          {renderFinalRowInlineModal(
            compact(flatMap(collectionsData.pages, (page) => page.Metadata)),
          )}
        </CustomTabPanel>,
      );
    }

    if (searchData) {
      const items = chain(searchData.pages)
        .reject((page) => page.size === 0)
        .map((page) => page.Metadata)
        .flatten()
        .take(scrollParams.limit)
        .value();

      elements.push(
        <CustomTabPanel value={tabValue} index={0} key="Library">
          {map(
            items,
            (item: PlexMovie | PlexTvShow | PlexMusicArtist, index: number) =>
              viewType === 'list' ? (
                <PlexListItem key={item.guid} item={item} />
              ) : (
                renderGridItems(item, index)
              ),
          )}
          {renderFinalRowInlineModal(items)}
        </CustomTabPanel>,
      );
    }

    return elements;
  };

  return (
    <>
      {!isNil(directoryChildren) &&
        directoryChildren.size > 0 &&
        selectedLibrary && (
          <Box sx={{ mt: 1 }}>
            <Stack direction="row" gap={1} sx={{ mt: 2 }}>
              <StandaloneToggleButton
                selected={searchVisible}
                onToggle={() => setSearchVisible(toggle)}
                toggleButtonProps={{
                  size: 'small',
                  sx: { mr: 1 },
                  color: 'primary',
                }}
              >
                <FilterAlt />
              </StandaloneToggleButton>
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
              <PlexSortField />
            </Stack>
            <Collapse in={searchVisible} mountOnEnter>
              <Box sx={{ py: 2 }}>
                <PlexFilterBuilder advanced={useAdvancedSearch} />
              </Box>
            </Collapse>

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              sx={{
                display: 'flex',
                pt: 1,
                columnGap: 1,
                alignItems: 'center',
                justifyContent: 'flex-end',
                flexGrow: 1,
              }}
            >
              <ToggleButtonGroup
                value={viewType}
                onChange={handleFormat}
                exclusive
              >
                <ToggleButton value="list">
                  <ViewList />
                </ToggleButton>
                <ToggleButton value="grid">
                  <GridView />
                </ToggleButton>
              </ToggleButtonGroup>
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
          <ConnectPlex />
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
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs
              value={tabValue}
              onChange={handleChange}
              aria-label="Plex media selector tabs"
              variant="scrollable"
              allowScrollButtonsMobile
            >
              <Tab label="Library" {...a11yProps(0)} />
              {!isUndefined(collectionsData) &&
                sumBy(collectionsData.pages, (page) => page.size) > 0 && (
                  <Tab label="Collections" {...a11yProps(1)} />
                )}
            </Tabs>
          </Box>

          <Box ref={gridContainerRef} sx={{ width: '100%' }}>
            {renderListItems()}
          </Box>
          <div style={{ height: 40 }} ref={ref}></div>
          <Divider sx={{ mt: 3, mb: 2 }} />
        </>
      )}
    </>
  );
}
