import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
} from '@mui/material';
import { PlexMedia, isPlexDirectory } from '@tunarr/types/plex';
import { find, isEmpty, isNil, isUndefined } from 'lodash-es';
import React, { useCallback, useEffect, useState } from 'react';
import { EnrichedPlexMedia, usePlex } from '../../hooks/plexHooks.ts';
import { usePlexServerSettings } from '../../hooks/settingsHooks.ts';
import { useCustomShows } from '../../hooks/useCustomShows.ts';
import useStore from '../../store/index.ts';
import {
  addKnownMediaForServer,
  setProgrammingListLibrary,
  setProgrammingListingServer,
} from '../../store/programmingSelector/actions.ts';
import { CustomShowProgrammingSelector } from './CustomShowProgrammingSelector.tsx';
import PlexProgrammingSelector from './PlexProgrammingSelector.tsx';

export interface PlexListItemProps<T extends PlexMedia> {
  item: T;
  style?: React.CSSProperties;
  index?: number;
  length: number;
  parent?: string;
}

type Props = {
  onAddSelectedMedia: (items: EnrichedPlexMedia[]) => void;
};

export default function ProgrammingSelector({ onAddSelectedMedia }: Props) {
  const { data: plexServers } = usePlexServerSettings();
  const selectedServer = useStore((s) => s.currentServer);
  const selectedLibrary = useStore((s) => s.currentLibrary);
  const knownMedia = useStore((s) => s.knownMediaByServer);
  const [mediaSource, setMediaSource] = useState(selectedServer?.name);

  // Convenience sub-selectors for specific library types
  const selectedPlexLibrary =
    selectedLibrary?.type === 'plex' ? selectedLibrary.library : undefined;
  const selectedCustomShow =
    selectedLibrary?.type === 'custom-show'
      ? selectedLibrary.library
      : undefined;

  const viewingCustomShows = mediaSource === 'custom-shows';

  /**
   * Load Plex libraries
   */
  const { data: plexLibraryChildren } = usePlex(
    selectedServer?.name ?? '',
    '/library/sections',
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
      addKnownMediaForServer(selectedServer!.name, [
        ...plexLibraryChildren.Directory,
      ]);
    }
  }, [selectedServer, plexLibraryChildren]);

  /**
   * Load custom shows
   */
  const { data: customShows } = useCustomShows([], {
    enabled: viewingCustomShows,
  });

  useEffect(() => {
    if (
      mediaSource === 'custom-shows' &&
      customShows &&
      customShows.length > 0
    ) {
      setProgrammingListLibrary({
        type: 'custom-show',
        library: customShows[0],
      });
    }
  }, [mediaSource, customShows]);

  const onMediaSourceChange = useCallback(
    (mediaSource: string) => {
      if (mediaSource === 'custom-shows') {
        // Not dealing with a server
        setProgrammingListingServer(undefined);
        setMediaSource(mediaSource);
      } else {
        const server = find(plexServers, { name: mediaSource });
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
      // TODO support loading custom shows
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
      return (
        <PlexProgrammingSelector onAddSelectedMedia={onAddSelectedMedia} />
      );
    }

    return null;
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
        {plexServers && (
          <FormControl size="small" margin="normal">
            <InputLabel>Media Source</InputLabel>
            <Select
              label="Media Source"
              value={
                viewingCustomShows ? 'custom-shows' : selectedServer?.name ?? ''
              }
              onChange={(e) => onMediaSourceChange(e.target.value)}
            >
              {plexServers?.map((server) => (
                <MenuItem key={server.name} value={server.name}>
                  Plex: {server.name}
                </MenuItem>
              ))}
              <MenuItem value="custom-shows">Custom Shows</MenuItem>
            </Select>
          </FormControl>
        )}

        {!isNil(plexLibraryChildren) &&
          plexLibraryChildren.size > 0 &&
          selectedPlexLibrary && (
            <FormControl size="small" margin="normal">
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

        {viewingCustomShows && customShows && selectedCustomShow && (
          <FormControl size="small" margin="normal">
            <InputLabel>Custom Show</InputLabel>
            <Select
              label="Custom Show"
              value={selectedCustomShow.id}
              onChange={(e) => onLibraryChange(e.target.value)}
            >
              {customShows.map((cs) => (
                <MenuItem key={cs.id} value={cs.id}>
                  {cs.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Stack>
      {renderMediaSourcePrograms()}
    </>
  );
}
