import {
  Divider,
  FormControl,
  InputLabel,
  List,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import {
  PlexLibrarySection,
  PlexMedia,
  isPlexDirectory,
} from '@tunarr/types/plex';
import { isEmpty, isNil, isUndefined, keys } from 'lodash-es';
import React, { useEffect } from 'react';
import { usePlex } from '../../hooks/plexHooks.ts';
import { usePlexServerSettings } from '../../hooks/settingsHooks.ts';
import useStore from '../../store/index.ts';
import {
  addKnownMediaForServer,
  setProgrammingListLibrary,
  setProgrammingListingServer,
} from '../../store/programmingSelector/actions.ts';
import { PlexDirectoryListItem } from './PlexDirectoryListItem.tsx';
import SelectedProgrammingList from './SelectedProgrammingList.tsx';
import useDebouncedState from '../../hooks/useDebouncedState.ts';
import { useQuery } from '@tanstack/react-query';

export interface PlexListItemProps<T extends PlexMedia> {
  item: T;
  style?: React.CSSProperties;
  index?: number;
  length: number;
  parent?: string;
}

export default function ProgrammingSelector() {
  const { data: plexServers } = usePlexServerSettings();
  const selectedServer = useStore((s) => s.currentServer);
  const selectedLibrary = useStore((s) => s.currentLibrary);
  // const listingsByServer = useStore((s) => s.listingsByServer);
  const knownMedia = useStore((s) => s.knownMediaByServer);
  const hierarchyByServer = useStore((s) => s.contentHierarchyByServer);

  useEffect(() => {
    const server =
      !isUndefined(plexServers) && !isEmpty(plexServers)
        ? plexServers[0]
        : undefined;

    setProgrammingListingServer(server);
  }, [plexServers]);

  const { data: directoryChildren } = usePlex(
    selectedServer?.name ?? '',
    '/library/sections',
    !isUndefined(selectedServer),
  );

  useEffect(() => {
    if (directoryChildren) {
      if (directoryChildren.size > 0) {
        setProgrammingListLibrary(directoryChildren.Directory[0].key);
      }
      addKnownMediaForServer(selectedServer!.name, [
        ...directoryChildren.Directory,
      ]);
    }
  }, [selectedServer, directoryChildren]);

  const [search, debounceSearch, setSearch] = useDebouncedState('', 300);

  const { isLoading: searchLoading, data: searchData } = useQuery({
    queryKey: ['plex-search', selectedServer, selectedLibrary, debounceSearch],
    enabled:
      !isNil(selectedServer) &&
      !isNil(selectedLibrary) &&
      !isNil(debounceSearch) &&
      debounceSearch.length > 0,
    queryFn: async () => {
      const plexQuery = new URLSearchParams({
        'Plex-Container-Start': '0',
        'Plex-Container-Size': '10',
        'title<': debounceSearch,
      });
      const query = new URLSearchParams({
        name: selectedServer!.name,
        path: `/library/sections/${selectedLibrary}/all?${plexQuery.toString()}`,
      });
      return await fetch(
        `http://localhost:8000/api/plex?${query.toString()}`,
      ).then((r) => r.json());
    },
  });

  useEffect(() => {
    if (debounceSearch && debounceSearch.length > 0) {
      console.log(debounceSearch);
    }
  }, [debounceSearch]);

  const renderListItems = () => {
    const directoryIds = keys(hierarchyByServer[selectedServer!.name]);
    const mediaForServer = knownMedia[selectedServer!.name] ?? {};

    return directoryIds
      .filter((id) => isPlexDirectory(mediaForServer[id]))
      .map((id) => (
        <PlexDirectoryListItem
          server={selectedServer!}
          key={id}
          item={mediaForServer[id] as PlexLibrarySection}
        />
      ));
  };

  return (
    <>
      {selectedServer && (
        <FormControl fullWidth size="small" margin="dense">
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
      {directoryChildren && directoryChildren.size > 0 && (
        <>
          <FormControl fullWidth size="small" margin="normal">
            <InputLabel>Library</InputLabel>
            <Select label="Library" value={directoryChildren.Directory[0].key}>
              {directoryChildren.Directory.map((dir) => (
                <MenuItem key={dir.key} value={dir.key}>
                  {dir.title}
                </MenuItem>
              ))}
              <MenuItem value="custom-shows">Custom Shows</MenuItem>
            </Select>
          </FormControl>
          <TextField
            size="small"
            label="Search"
            margin="dense"
            fullWidth
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </>
      )}
      {/* <List component="nav" sx={{ width: '100%' }}>
        {selectedServer && renderListItems()}
      </List> */}
      <Divider sx={{ mt: 3, mb: 2 }} />
      <Typography>Selected Items</Typography>
      <SelectedProgrammingList />
    </>
  );
}
