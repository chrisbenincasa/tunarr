import { FormControl, List, MenuItem, Select, Typography } from '@mui/material';
import {
  PlexLibrarySection,
  PlexMedia,
  isPlexDirectory,
} from '@tunarr/types/plex';
import { isEmpty, isUndefined, keys } from 'lodash-es';
import React, { useEffect } from 'react';
import { usePlex } from '../../hooks/plexHooks.ts';
import { usePlexServerSettings } from '../../hooks/settingsHooks.ts';
import useStore from '../../store/index.ts';
import {
  addKnownMediaForServer,
  setProgrammingListingServer,
} from '../../store/programmingSelector/actions.ts';
import { PlexDirectoryListItem } from './PlexDirectoryListItem.tsx';
import SelectedProgrammingList from './SelectedProgrammingList.tsx';

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
      addKnownMediaForServer(selectedServer!.name, [
        ...directoryChildren.Directory,
      ]);
    }
  }, [selectedServer, directoryChildren]);

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
      <FormControl fullWidth size="small">
        {selectedServer && (
          <Select value={selectedServer?.name}>
            {plexServers?.map((server) => (
              <MenuItem key={server.name} value={server.name}>
                {server.name}
              </MenuItem>
            ))}
          </Select>
        )}
      </FormControl>
      <List component="nav" sx={{ width: '100%' }}>
        {selectedServer && renderListItems()}
      </List>
      <Typography>Selected Items</Typography>
      <SelectedProgrammingList />
    </>
  );
}
