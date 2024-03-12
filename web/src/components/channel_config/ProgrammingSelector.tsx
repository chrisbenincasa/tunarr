import {
  Clear,
  ExpandLess,
  ExpandMore,
  GridView,
  Search,
  ViewList,
} from '@mui/icons-material';
import {
  Box,
  Collapse,
  Divider,
  FormControl,
  Grow,
  IconButton,
  InputAdornment,
  InputLabel,
  LinearProgress,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { DataTag, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  PlexLibraryCollections,
  PlexLibraryMovies,
  PlexLibraryShows,
  PlexMedia,
  PlexMovie,
  PlexTvShow,
  isPlexDirectory,
} from '@tunarr/types/plex';
import { chain, first, isEmpty, isNil, isUndefined, map } from 'lodash-es';
import React, { Fragment, useCallback, useEffect, useState } from 'react';
import { useIntersectionObserver } from 'usehooks-ts';
import { toggle } from '../../helpers/util.ts';
import { fetchPlexPath, usePlex } from '../../hooks/plexHooks.ts';
import { usePlexServerSettings } from '../../hooks/settingsHooks.ts';
import useDebouncedState from '../../hooks/useDebouncedState.ts';
import useStore from '../../store/index.ts';
import {
  addKnownMediaForServer,
  setProgrammingListLibrary,
  setProgrammingListingServer,
} from '../../store/programmingSelector/actions.ts';
import { setProgrammingSelectorViewState } from '../../store/themeEditor/actions.ts';
import ConnectPlex from '../settings/ConnectPlex.tsx';
import { PlexGridItem } from './PlexGridItem.tsx';
import { PlexListItem } from './PlexListItem.tsx';
import SelectedProgrammingList from './SelectedProgrammingList.tsx';

export interface PlexListItemProps<T extends PlexMedia> {
  item: T;
  style?: React.CSSProperties;
  index?: number;
  length: number;
  parent?: string;
}

type ViewType = 'list' | 'grid';

export default function ProgrammingSelector() {
  const { data: plexServers } = usePlexServerSettings();
  const selectedServer = useStore((s) => s.currentServer);
  const selectedLibrary = useStore((s) => s.currentLibrary);
  const knownMedia = useStore((s) => s.knownMediaByServer);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const viewType = useStore((state) => state.theme.programmingSelectorView);
  const [searchBarOpen, setSearchBarOpen] = useState(false);

  const setViewType = (view: ViewType) => {
    setProgrammingSelectorViewState(view);
  };

  const handleFormat = (
    event: React.MouseEvent<HTMLElement>, // eslint-disable-line
    newFormats: ViewType,
  ) => {
    setViewType(newFormats);
  };

  const handleSearchOpen = () => {
    setSearchBarOpen(!searchBarOpen);
  };

  useEffect(() => {
    const server =
      !isUndefined(plexServers) && !isEmpty(plexServers)
        ? plexServers[0]
        : undefined;

    setProgrammingListingServer(server);
  }, [plexServers]);

  const [scrollParams, setScrollParams] = useState({ limit: 0, max: -1 });
  const [search, debounceSearch, setSearch] = useDebouncedState('', 300);

  const { data: directoryChildren } = usePlex(
    selectedServer?.name ?? '',
    '/library/sections',
    !isUndefined(selectedServer),
  );

  useEffect(() => {
    if (directoryChildren) {
      if (directoryChildren.size > 0) {
        setProgrammingListLibrary(directoryChildren.Directory[0]);
      }
      addKnownMediaForServer(selectedServer!.name, [
        ...directoryChildren.Directory,
      ]);
    }
    setCollectionsOpen(false);
  }, [selectedServer, directoryChildren]);

  const { isLoading: searchLoading, data: searchData } = useInfiniteQuery({
    queryKey: [
      'plex-search',
      selectedServer?.name,
      selectedLibrary?.key,
      debounceSearch,
    ] as DataTag<
      ['plex-search', string, string, string],
      PlexLibraryMovies | PlexLibraryShows
    >,
    enabled: !isNil(selectedServer) && !isNil(selectedLibrary),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => {
      const plexQuery = new URLSearchParams({
        'Plex-Container-Start': pageParam.toString(),
        'Plex-Container-Size': '10',
      });

      if (!isNil(debounceSearch) && !isEmpty(debounceSearch)) {
        plexQuery.set('title<', debounceSearch);
      }

      return fetchPlexPath<PlexLibraryMovies | PlexLibraryShows>(
        selectedServer!.name,
        `/library/sections/${selectedLibrary!.key}/all?${plexQuery.toString()}`,
      )();
    },
    getNextPageParam: (res, _, last) => {
      if (res.size < 10) {
        return null;
      }

      return last + 10;
    },
  });

  const { data: collectionsData } = useQuery({
    queryKey: [
      'plex',
      selectedServer?.name,
      selectedLibrary?.key,
      'collections',
    ],
    queryFn: () => {
      return fetchPlexPath<PlexLibraryCollections>(
        selectedServer!.name,
        `/library/sections/${selectedLibrary!.key}/collections?`,
      )();
    },
    enabled: !isNil(selectedServer) && !isNil(selectedLibrary),
  });

  useEffect(() => {
    if (searchData) {
      // We're using this as an analogue for detecting the start of a new 'query'
      if (searchData.pages.length === 1) {
        setScrollParams({
          limit: 16,
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
  }, [selectedServer, searchData, setScrollParams]);

  useEffect(() => {
    if (selectedServer?.name && collectionsData && collectionsData.Metadata) {
      addKnownMediaForServer(selectedServer.name, collectionsData.Metadata);
    }
  }, [selectedServer?.name, collectionsData]);

  const onLibraryChange = useCallback(
    (libraryUuid: string) => {
      if (selectedServer) {
        const known = knownMedia[selectedServer.name] ?? {};
        const library = known[libraryUuid];
        if (library && isPlexDirectory(library)) {
          setProgrammingListLibrary(library);
        }
      }
    },
    [knownMedia, selectedServer],
  );

  const { ref } = useIntersectionObserver({
    onChange: (_, entry) => {
      if (entry.isIntersecting && scrollParams.limit < scrollParams.max) {
        setScrollParams(({ limit: prevLimit, max }) => ({
          max,
          limit: prevLimit + 10,
        }));
      }
    },
    threshold: 0.5,
  });

  const clearSearchInput = useCallback(() => {
    setSearch('');
    setSearchBarOpen(false);
  }, [setSearch]);

  const renderListItems = () => {
    const elements: JSX.Element[] = [];

    if (collectionsData && collectionsData.size > 0) {
      elements.push(
        <Fragment key="collections">
          <ListItemButton
            onClick={() => setCollectionsOpen(toggle)}
            dense
            sx={
              viewType === 'grid' ? { display: 'block', width: '100%' } : null
            }
          >
            <ListItemIcon>
              {collectionsOpen ? <ExpandLess /> : <ExpandMore />}
            </ListItemIcon>
            <ListItemText
              primary="Collections"
              secondary={`${collectionsData.size} Collection${
                collectionsData.size === 1 ? '' : 's'
              }`}
            />
          </ListItemButton>
          <Collapse
            in={collectionsOpen}
            timeout="auto"
            sx={{ display: 'block', width: '100%' }}
          >
            {map(collectionsData.Metadata, (item) =>
              viewType === 'list' ? (
                <PlexListItem key={item.guid} item={item} />
              ) : (
                <PlexGridItem key={item.guid} item={item} />
              ),
            )}
          </Collapse>
        </Fragment>,
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
        ...map(items, (item: PlexMovie | PlexTvShow) => {
          return viewType === 'list' ? (
            <PlexListItem key={item.guid} item={item} />
          ) : (
            <PlexGridItem key={item.guid} item={item} />
          );
        }),
      );
    }
    return elements;
  };

  return (
    <>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={{
          display: 'flex',
          columnGap: 1,
          justifyContent: 'flex-start',
          flexGrow: 1,
        }}
      >
        {selectedServer && (
          <FormControl size="small" margin="normal">
            <InputLabel>Media Source</InputLabel>
            <Select label="Media Source" value={selectedServer?.name}>
              {plexServers?.map((server) => (
                <MenuItem key={server.name} value={server.name}>
                  Plex: {server.name}
                </MenuItem>
              ))}
              <MenuItem value="custom-shows">Custom Shows</MenuItem>
            </Select>
          </FormControl>
        )}

        {!isNil(directoryChildren) &&
          directoryChildren.size > 0 &&
          selectedLibrary && (
            <FormControl size="small" margin="normal">
              <InputLabel>Library</InputLabel>
              <Select
                label="Library"
                value={selectedLibrary.uuid}
                onChange={(e) => onLibraryChange(e.target.value)}
              >
                {directoryChildren.Directory.map((dir) => (
                  <MenuItem key={dir.key} value={dir.uuid}>
                    {dir.title}
                  </MenuItem>
                ))}
                <MenuItem value="custom-shows">Custom Shows</MenuItem>
              </Select>
            </FormControl>
          )}
      </Stack>

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
                  onChange={() => handleSearchOpen()}
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
          <List
            component="nav"
            sx={{
              mt: 2,
              width: '100%',
              maxHeight: 1200,
              overflowY: 'scroll',
              display: viewType === 'grid' ? 'flex' : 'block',
              flexWrap: 'wrap',
              gap: '10px',
              justifyContent: 'space-between',
            }}
          >
            {renderListItems()}
            <div style={{ height: 40 }} ref={ref}></div>
          </List>

          <Divider sx={{ mt: 3, mb: 2 }} />
          <Typography>Selected Items</Typography>
          <SelectedProgrammingList />
        </>
      )}
    </>
  );
}
