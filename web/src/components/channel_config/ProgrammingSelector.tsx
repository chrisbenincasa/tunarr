import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import { PlexMedia, isPlexDirectory } from '@tunarr/types/plex';
import { find, isEmpty, isNil, isUndefined, map } from 'lodash-es';
import React, { useCallback, useEffect, useState } from 'react';
import { usePlexLibraries } from '../../hooks/plexHooks.ts';
import { usePlexServerSettings } from '../../hooks/settingsHooks.ts';
import { useCustomShows } from '../../hooks/useCustomShows.ts';
import useStore from '../../store/index.ts';
import {
  addKnownMediaForServer,
  setProgrammingListLibrary,
  setProgrammingListingServer,
} from '../../store/programmingSelector/actions.ts';
import { AddedMedia } from '../../types/index.ts';
import { CustomShowProgrammingSelector } from './CustomShowProgrammingSelector.tsx';
import PlexProgrammingSelector from './PlexProgrammingSelector.tsx';
import SelectedProgrammingList from './SelectedProgrammingList.tsx';

export interface PlexListItemProps<T extends PlexMedia> {
  item: T;
  style?: React.CSSProperties;
  index?: number;
  length: number;
  parent?: string;
}

type Props = {
  onAddSelectedMedia: (items: AddedMedia[]) => void;
  onAddMediaSuccess: () => void;
};

export default function ProgrammingSelector({
  onAddSelectedMedia,
  onAddMediaSuccess,
}: Props) {
  const { data: plexServers } = usePlexServerSettings();
  const selectedServer = useStore((s) => s.currentServer);
  const selectedLibrary = useStore((s) => s.currentLibrary);
  const knownMedia = useStore((s) => s.knownMediaByServer);
  const [mediaSource, setMediaSource] = useState(selectedServer?.name);

  // Convenience sub-selectors for specific library types
  const selectedPlexLibrary =
    selectedLibrary?.type === 'plex' ? selectedLibrary.library : undefined;

  const viewingCustomShows = mediaSource === 'custom-shows';

  /**
   * Load Plex libraries
   */
  const { data: plexLibraryChildren } = usePlexLibraries(
    selectedServer?.name ?? '',
    !isUndefined(selectedServer),
  );

  useEffect(() => {
    const server =
      !isUndefined(plexServers) && !isEmpty(plexServers)
        ? plexServers[0]
        : undefined;

    setProgrammingListingServer(server);
  }, [plexServers]);

  useEffect(() => {
    if (selectedServer && plexLibraryChildren) {
      if (plexLibraryChildren.size > 0) {
        setProgrammingListLibrary({
          type: 'plex',
          library: plexLibraryChildren.Directory[0],
        });
      }
      addKnownMediaForServer(selectedServer.name, [
        ...plexLibraryChildren.Directory,
      ]);
    }
  }, [selectedServer, plexLibraryChildren]);

  /**
   * Load custom shows
   */
  const { data: customShows } = useCustomShows([]);

  const onMediaSourceChange = useCallback(
    (newMediaSource: string) => {
      if (newMediaSource === 'custom-shows') {
        // Not dealing with a server
        setProgrammingListLibrary({ type: 'custom-show' });
        setProgrammingListingServer(undefined);
        setMediaSource(newMediaSource);
      } else {
        const server = find(plexServers, { name: newMediaSource });
        if (server) {
          setProgrammingListingServer(server);
          setMediaSource(server.name);
        }
      }
    },
    [plexServers],
  );

  const onLibraryChange = useCallback(
    (libraryUuid: string) => {
      if (selectedServer) {
        const known = knownMedia[selectedServer.name] ?? {};
        const library = known[libraryUuid];
        if (library && isPlexDirectory(library)) {
          setProgrammingListLibrary({ type: 'plex', library });
        }
      }
    },
    [knownMedia, selectedServer],
  );

  const renderMediaSourcePrograms = () => {
    if (selectedLibrary?.type === 'custom-show') {
      return <CustomShowProgrammingSelector />;
    } else if (selectedLibrary?.type === 'plex') {
      return <PlexProgrammingSelector />;
    }

    return null;
  };

  const hasAnySources =
    (plexServers && plexServers.length > 0) || customShows.length > 0;

  return (
    <Box sx={{ p: 1 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={{
          display: 'flex',
          columnGap: 1,
          justifyContent: 'flex-start',
          flexGrow: 1,
        }}
      >
        {hasAnySources && (
          <FormControl size="small" sx={{ minWidth: { sm: 200 } }}>
            <InputLabel>Media Source</InputLabel>
            <Select
              label="Media Source"
              value={
                viewingCustomShows ? 'custom-shows' : selectedServer?.name ?? ''
              }
              onChange={(e) => onMediaSourceChange(e.target.value)}
            >
              {map(plexServers, (server) => (
                <MenuItem key={server.name} value={server.name}>
                  Plex: {server.name}
                </MenuItem>
              ))}
              {customShows.length > 0 && (
                <MenuItem value="custom-shows">Custom Shows</MenuItem>
              )}
            </Select>
          </FormControl>
        )}

        {!isNil(plexLibraryChildren) &&
          plexLibraryChildren.size > 0 &&
          selectedPlexLibrary && (
            <FormControl size="small" sx={{ minWidth: { sm: 200 } }}>
              <InputLabel>Library</InputLabel>
              <Select
                label="Library"
                value={selectedPlexLibrary.uuid}
                onChange={(e) => onLibraryChange(e.target.value)}
              >
                {plexLibraryChildren.Directory.map((dir) => (
                  <MenuItem key={dir.key} value={dir.uuid}>
                    {dir.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
      </Stack>
      {renderMediaSourcePrograms()}
      <Typography>Selected Items</Typography>
      <SelectedProgrammingList
        onAddSelectedMedia={onAddSelectedMedia}
        onAddMediaSuccess={onAddMediaSuccess}
      />
    </Box>
  );
}
