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
import { DataTag, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  PlexLibraryCollections,
  PlexLibraryMovies,
  PlexLibraryMusic,
  PlexLibraryShows,
  PlexMedia,
  PlexMovie,
  PlexMusicArtist,
  PlexTvShow,
} from '@tunarr/types/plex';
import { chain, first, forEach, isNil, isUndefined, map } from 'lodash-es';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useIntersectionObserver } from 'usehooks-ts';
import {
  firstItemInNextRow,
  getImagesPerRow,
} from '../../helpers/inlineModalUtil';
import { toggle } from '../../helpers/util.ts';
import { fetchPlexPath, usePlex } from '../../hooks/plexHooks';
import { usePlexServerSettings } from '../../hooks/settingsHooks';
import useStore from '../../store';
import { addKnownMediaForServer } from '../../store/programmingSelector/actions';
import { setProgrammingSelectorViewState } from '../../store/themeEditor/actions';
import { ProgramSelectorViewType } from '../../types';
import InlineModal from '../InlineModal';
import CustomTabPanel from '../TabPanel';
import StandaloneToggleButton from '../base/StandaloneToggleButton.tsx';
import ConnectPlex from '../settings/ConnectPlex';
import { PlexFilterBuilder } from './PlexFilterBuilder.tsx';
import PlexGridItem from './PlexGridItem';
import { PlexListItem } from './PlexListItem';
import { PlexSortField } from './PlexSortField.tsx';

function a11yProps(index: number) {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  };
}

export default function PlexProgrammingSelector() {
  const { data: plexServers } = usePlexServerSettings();
  const selectedServer = useStore((s) => s.currentServer);
  const selectedLibrary = useStore((s) =>
    s.currentLibrary?.type === 'plex' ? s.currentLibrary : null,
  );
  const viewType = useStore((state) => state.theme.programmingSelectorView);
  const [tabValue, setTabValue] = useState(0);
  const [modalChildren, setModalChildren] = useState<PlexMedia[]>([]);
  const [rowSize, setRowSize] = useState<number>(16);
  const [modalIndex, setModalIndex] = useState<number>(-1);
  const [modalIsPending, setModalIsPending] = useState<boolean>(true);
  const [scrollParams, setScrollParams] = useState({ limit: 0, max: -1 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const libraryImageRef = useRef<HTMLDivElement>(null);
  const libraryContainerRef = useRef<HTMLDivElement>(null);
  const [searchVisible, setSearchVisible] = useState(false);
  const [useAdvancedSearch, setUseAdvancedSearch] = useState(false);

  const handleResize = () => {
    if (tabValue === 0) {
      const libraryContainerWidth =
        libraryContainerRef?.current?.offsetWidth || 0;
      setRowSize(getImagesPerRow(libraryContainerWidth, 160)); // to do: remove magic number
    } else {
      // Collections initial load
      const containerWidth = containerRef?.current?.offsetWidth || 0;
      const itemWidth = imageRef?.current?.offsetWidth || 0;

      setRowSize(getImagesPerRow(containerWidth, itemWidth));
    }
  };

  useEffect(() => {
    if (viewType === 'grid') {
      const handleResizeEvent = () => handleResize();
      handleResize(); // Call initially to set width
      window.addEventListener('resize', handleResizeEvent);

      // Cleanup function to remove event listener
      return () => window.removeEventListener('resize', handleResizeEvent);
    }
  }, []);

  useEffect(() => {
    if (viewType === 'grid') {
      const containerWidth = containerRef?.current?.offsetWidth || 0;
      const itemWidth = imageRef?.current?.offsetWidth || 0;

      setRowSize(getImagesPerRow(containerWidth, itemWidth));
    }
  }, [containerRef, imageRef, modalChildren]);

  useEffect(() => {
    setModalIndex(-1);
    handleModalChildren([]);
  }, [tabValue]);

  const handleChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleMoveModal = useCallback(
    (index: number) => {
      if (index === modalIndex) {
        handleModalChildren([]);
        setModalIndex(-1);
      } else {
        handleModalChildren([]);
        setModalIndex(index);
      }
    },
    [modalIndex],
  );

  const handleModalChildren = useCallback(
    (children: PlexMedia[]) => {
      setModalChildren(children);
    },
    [modalChildren],
  );

  const handleModalIsPending = useCallback(
    (isPending: boolean) => {
      setModalIsPending(isPending);
    },
    [modalIsPending],
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

  const { isLoading: isCollectionLoading, data: collectionsData } = useQuery({
    queryKey: [
      'plex',
      selectedServer?.name,
      selectedLibrary?.library.key,
      'collections',
    ],
    queryFn: () => {
      return fetchPlexPath<PlexLibraryCollections>(
        selectedServer!.name,
        `/library/sections/${selectedLibrary?.library.key}/collections?`,
      )();
    },
    enabled: !isNil(selectedServer) && !isNil(selectedLibrary),
  });

  useEffect(() => {
    // When switching between Libraries, if a collection doesn't exist switch back to 'Library' tab
    if (!collectionsData && !isCollectionLoading && tabValue === 1) {
      setTabValue(0);
    }
  }, [collectionsData, isCollectionLoading]);

  const { urlFilter: searchKey } = useStore(
    ({ plexSearch: plexQuery }) => plexQuery,
  );

  const { isLoading: searchLoading, data: searchData } = useInfiniteQuery({
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
        'Plex-Container-Start': pageParam.toString(),
        'Plex-Container-Size': (rowSize * 4).toString(),
      });
      // HACK for now
      forEach(searchKey?.split('&'), (keyval) => {
        const idx = keyval.lastIndexOf('=');
        if (idx !== -1) {
          plexQuery.append(keyval.substring(0, idx), keyval.substring(idx + 1));
        }
      });

      // if (!isNil(debounceSearch) && !isEmpty(debounceSearch)) {
      //   plexQuery.set('title<', debounceSearch);
      // }

      return fetchPlexPath<
        PlexLibraryMovies | PlexLibraryShows | PlexLibraryMusic
      >(
        selectedServer!.name,
        `/library/sections/${
          selectedLibrary!.library.key
        }/all?${plexQuery.toString()}`,
      )();
    },
    getNextPageParam: (res, _, last) => {
      if (res.size < rowSize * 4) {
        return null;
      }

      return last + rowSize * 4;
    },
  });

  useEffect(() => {
    if (searchData) {
      handleResize(); // Call initially to set rowSize

      // We're using this as an analogue for detecting the start of a new 'query'
      if (searchData.pages.length === 1) {
        setScrollParams({
          limit: rowSize * 4,
          max: first(searchData.pages)!.size,
        });
      }

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
  }, [selectedServer, searchData, setScrollParams, rowSize]);

  useEffect(() => {
    if (selectedServer?.name && collectionsData && collectionsData.Metadata) {
      addKnownMediaForServer(selectedServer.name, collectionsData.Metadata);
    }
  }, [selectedServer?.name, collectionsData]);

  const { ref } = useIntersectionObserver({
    onChange: (_, entry) => {
      if (entry.isIntersecting && scrollParams.limit < scrollParams.max) {
        setScrollParams(({ limit: prevLimit, max }) => ({
          max,
          limit: prevLimit + rowSize * 4,
        }));
      }
    },
    threshold: 0.5,
  });

  const renderListItems = () => {
    const elements: JSX.Element[] = [];

    if (collectionsData && collectionsData.size > 0 && tabValue === 1) {
      elements.push(
        <CustomTabPanel
          value={tabValue}
          index={1}
          key="Collections"
          ref={containerRef}
        >
          {map(collectionsData.Metadata, (item, index: number) =>
            viewType === 'list' ? (
              <PlexListItem key={item.guid} item={item} />
            ) : (
              <React.Fragment key={item.guid}>
                <InlineModal
                  modalIndex={modalIndex}
                  modalChildren={modalChildren}
                  open={
                    index ===
                    firstItemInNextRow(
                      modalIndex,
                      rowSize,
                      collectionsData?.Metadata?.length || 0,
                    )
                  }
                />
                <PlexGridItem
                  item={item}
                  index={index}
                  modalIndex={modalIndex}
                  moveModal={() => handleMoveModal(index)}
                  modalChildren={(children: PlexMedia[]) =>
                    handleModalChildren(children)
                  }
                  modalIsPending={(isPending: boolean) =>
                    handleModalIsPending(isPending)
                  }
                  ref={imageRef}
                />
              </React.Fragment>
            ),
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
        <CustomTabPanel
          value={tabValue}
          index={0}
          key="Library"
          ref={libraryContainerRef}
        >
          {map(
            items,
            (item: PlexMovie | PlexTvShow | PlexMusicArtist, idx: number) => {
              return viewType === 'list' ? (
                <PlexListItem key={item.guid} item={item} />
              ) : (
                <PlexGridItem
                  key={item.guid}
                  item={item}
                  modalIndex={modalIndex}
                  index={idx}
                  ref={libraryImageRef}
                />
              );
            },
          )}
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
              aria-label="basic tabs example"
            >
              <Tab label="Library" {...a11yProps(0)} />
              {collectionsData && collectionsData.size > 0 && (
                <Tab label="Collections" {...a11yProps(1)} />
              )}
            </Tabs>
          </Box>

          {renderListItems()}
          <div style={{ height: 40 }} ref={ref}></div>
          <Divider sx={{ mt: 3, mb: 2 }} />
        </>
      )}
    </>
  );
}
