import Clear from '@mui/icons-material/Clear';
import GridView from '@mui/icons-material/GridView';
import Search from '@mui/icons-material/Search';
import ViewList from '@mui/icons-material/ViewList';
import {
  Box,
  Divider,
  Grow,
  IconButton,
  InputAdornment,
  LinearProgress,
  Stack,
  Tab,
  Tabs,
  TextField,
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
import { chain, first, isEmpty, isNil, isUndefined, map } from 'lodash-es';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useIntersectionObserver } from 'usehooks-ts';
import {
  firstItemInNextRow,
  getImagesPerRow,
} from '../../helpers/inlineModalUtil';
import { toggle } from '../../helpers/util';
import { fetchPlexPath, usePlex } from '../../hooks/plexHooks';
import { usePlexServerSettings } from '../../hooks/settingsHooks';
import useDebouncedState from '../../hooks/useDebouncedState';
import useStore from '../../store';
import { addKnownMediaForServer } from '../../store/programmingSelector/actions';
import { setProgrammingSelectorViewState } from '../../store/themeEditor/actions';
import { ProgramSelectorViewType } from '../../types';
import InlineModal from '../InlineModal';
import CustomTabPanel from '../TabPanel';
import ConnectPlex from '../settings/ConnectPlex';
import PlexGridItem from './PlexGridItem';
import { PlexListItem } from './PlexListItem';

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
  const [searchBarOpen, setSearchBarOpen] = useState(false);
  const [search, debounceSearch, setSearch] = useDebouncedState('', 300);
  const [scrollParams, setScrollParams] = useState({ limit: 0, max: -1 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const libraryImageRef = useRef<HTMLDivElement>(null);
  const libraryContainerRef = useRef<HTMLDivElement>(null);

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
  }, [tabValue]);

  const handleChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleMoveModal = useCallback(
    (index: number) => {
      if (index === modalIndex) {
        setModalIndex(-1);
      } else {
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

  const clearSearchInput = useCallback(() => {
    setSearch('');
    setSearchBarOpen(false);
  }, [setSearch]);

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

  const { isLoading: searchLoading, data: searchData } = useInfiniteQuery({
    queryKey: [
      'plex-search',
      selectedServer?.name,
      selectedLibrary?.library.key,
      debounceSearch,
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

      if (!isNil(debounceSearch) && !isEmpty(debounceSearch)) {
        plexQuery.set('title<', debounceSearch);
      }

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
              <>
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
                  key={item.guid}
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
              </>
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
          <>
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
              <Grow in={searchBarOpen} mountOnEnter>
                <TextField
                  label="Search"
                  margin="dense"
                  variant="outlined"
                  fullWidth
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  key={'searchbar'}
                  sx={{ m: 0 }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={clearSearchInput}
                          onMouseDown={(e) => e.preventDefault()}
                          edge="end"
                        >
                          <Clear />
                        </IconButton>
                      </InputAdornment>
                    ),
                    sx: { height: '48px' },
                  }}
                />
              </Grow>
              {!searchBarOpen && (
                <ToggleButton
                  value={searchBarOpen}
                  onChange={() => setSearchBarOpen(toggle)}
                >
                  <Search />
                </ToggleButton>
              )}
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
          </>
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
