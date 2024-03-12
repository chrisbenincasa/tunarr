import { ExpandLess, ExpandMore } from '@mui/icons-material';
import Clear from '@mui/icons-material/Clear';
import GridView from '@mui/icons-material/GridView';
import Search from '@mui/icons-material/Search';
import ViewList from '@mui/icons-material/ViewList';
import {
  Box,
  Collapse,
  Divider,
  Grow,
  IconButton,
  InputAdornment,
  LinearProgress,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
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
  PlexMovie,
  PlexTvShow,
} from '@tunarr/types/plex';
import { chain, first, isEmpty, isNil, isUndefined, map } from 'lodash-es';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { useIntersectionObserver } from 'usehooks-ts';
import { toggle } from '../../helpers/util';
import {
  EnrichedPlexMedia,
  fetchPlexPath,
  usePlex,
} from '../../hooks/plexHooks';
import { usePlexServerSettings } from '../../hooks/settingsHooks';
import useDebouncedState from '../../hooks/useDebouncedState';
import useStore from '../../store';
import { addKnownMediaForServer } from '../../store/programmingSelector/actions';
import { setProgrammingSelectorViewState } from '../../store/themeEditor/actions';
import ConnectPlex from '../settings/ConnectPlex';
import { PlexGridItem } from './PlexGridItem';
import { PlexListItem } from './PlexListItem';
import SelectedProgrammingList from './SelectedProgrammingList';

type ViewType = 'list' | 'grid';

type Props = {
  onAddSelectedMedia: (items: EnrichedPlexMedia[]) => void;
};

export default function PlexProgrammingSelector({ onAddSelectedMedia }: Props) {
  const { data: plexServers } = usePlexServerSettings();
  const selectedServer = useStore((s) => s.currentServer);
  const selectedLibrary = useStore((s) =>
    s.currentLibrary?.type === 'plex' ? s.currentLibrary : null,
  );
  const viewType = useStore((state) => state.theme.programmingSelectorView);

  const [searchBarOpen, setSearchBarOpen] = useState(false);
  const [search, debounceSearch, setSearch] = useDebouncedState('', 300);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [scrollParams, setScrollParams] = useState({ limit: 0, max: -1 });

  const { data: directoryChildren } = usePlex(
    selectedServer?.name ?? '',
    '/library/sections',
    !isUndefined(selectedServer),
  );

  const clearSearchInput = useCallback(() => {
    setSearch('');
    setSearchBarOpen(false);
  }, [setSearch]);

  const setViewType = (view: ViewType) => {
    setProgrammingSelectorViewState(view);
  };

  const handleFormat = (
    _event: React.MouseEvent<HTMLElement>,
    newFormats: ViewType,
  ) => {
    setViewType(newFormats);
  };

  const { data: collectionsData } = useQuery({
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

  const { isLoading: searchLoading, data: searchData } = useInfiniteQuery({
    queryKey: [
      'plex-search',
      selectedServer?.name,
      selectedLibrary?.library.key,
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
        `/library/sections/${
          selectedLibrary!.library.key
        }/all?${plexQuery.toString()}`,
      )();
    },
    getNextPageParam: (res, _, last) => {
      if (res.size < 10) {
        return null;
      }

      return last + 10;
    },
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
          <SelectedProgrammingList onAddSelectedMedia={onAddSelectedMedia} />
        </>
      )}
    </>
  );
}
