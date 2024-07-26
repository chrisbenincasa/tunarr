import {
  Alert,
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import { PlexMedia, isPlexDirectory } from '@tunarr/types/plex';
import {
  capitalize,
  chain,
  find,
  isEmpty,
  isNil,
  isUndefined,
  map,
  sortBy,
} from 'lodash-es';
import React, { useCallback, useEffect, useState } from 'react';
import { usePlexLibraries } from '../../hooks/plex/usePlex.ts';
import { useMediaSources } from '../../hooks/settingsHooks.ts';
import { useCustomShows } from '../../hooks/useCustomShows.ts';
import useStore from '../../store/index.ts';
import {
  addKnownMediaForJellyfinServer,
  addKnownMediaForPlexServer,
  setProgrammingListLibrary,
  setProgrammingListingServer,
} from '../../store/programmingSelector/actions.ts';
import AddPlexServer from '../settings/AddPlexServer.tsx';
import { CustomShowProgrammingSelector } from './CustomShowProgrammingSelector.tsx';
import PlexProgrammingSelector from './PlexProgrammingSelector.tsx';
import { useJellyfinUserLibraries } from '@/hooks/jellyfin/useJellyfinApi.ts';
import { JellyfinProgrammingSelector } from './JellyfinProgrammingSelector.tsx';
import { useKnownMedia } from '@/store/programmingSelector/selectors.ts';
import { JellyfinItem } from '@tunarr/types/jellyfin';

const sortJellyfinLibraries = (item: JellyfinItem) => {
  if (item.CollectionType) {
    switch (item.CollectionType) {
      case 'tvshows':
        return 0;
      case 'movies':
      case 'music':
        return 1;
      case 'unknown':
      case 'musicvideos':
      case 'trailers':
      case 'homevideos':
      case 'boxsets':
      case 'books':
      case 'photos':
      case 'livetv':
      case 'playlists':
      case 'folders':
        return 2;
    }
  }

  return Number.MAX_SAFE_INTEGER;
};

export interface PlexListItemProps<T extends PlexMedia> {
  item: T;
  style?: React.CSSProperties;
  index?: number;
  length: number;
  parent?: string;
}

type Props = {
  initialMediaSourceId?: string;
  initialLibraryId?: string;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function ProgrammingSelector(_: Props) {
  const { data: mediaSources, isLoading: mediaSourcesLoading } =
    useMediaSources();
  const selectedServer = useStore((s) => s.currentServer);
  const selectedLibrary = useStore((s) => s.currentLibrary);
  const knownMedia = useKnownMedia();
  const [mediaSource, setMediaSource] = useState(selectedServer?.name);

  // Convenience sub-selectors for specific library types
  const selectedPlexLibrary =
    selectedLibrary?.type === 'plex' ? selectedLibrary.library : undefined;
  const selectedJellyfinLibrary =
    selectedLibrary?.type === 'jellyfin' ? selectedLibrary.library : undefined;

  const viewingCustomShows = mediaSource === 'custom-shows';

  const { data: plexLibraryChildren } = usePlexLibraries(
    selectedServer?.name ?? '',
    selectedServer?.type === 'plex',
  );

  const { data: jellyfinLibraries } = useJellyfinUserLibraries(
    selectedServer?.id ?? '',
    selectedServer?.type === 'jellyfin',
  );

  useEffect(() => {
    const server =
      !isUndefined(mediaSources) && !isEmpty(mediaSources)
        ? mediaSources[0]
        : undefined;

    setProgrammingListingServer(server);
  }, [mediaSources]);

  useEffect(() => {
    if (selectedServer?.type === 'plex' && plexLibraryChildren) {
      if (plexLibraryChildren.size > 0) {
        setProgrammingListLibrary({
          type: 'plex',
          library: plexLibraryChildren.Directory[0],
        });
      }
      addKnownMediaForPlexServer(selectedServer.id, [
        ...plexLibraryChildren.Directory,
      ]);
    } else if (selectedServer?.type === 'jellyfin' && jellyfinLibraries) {
      if (jellyfinLibraries.Items.length > 0) {
        setProgrammingListLibrary({
          type: 'jellyfin',
          library: sortBy(jellyfinLibraries.Items, sortJellyfinLibraries)[0],
        });
      }
      addKnownMediaForJellyfinServer(selectedServer.id, [
        ...jellyfinLibraries.Items,
      ]);
    }
  }, [selectedServer, plexLibraryChildren, jellyfinLibraries]);

  /**
   * Load custom shows
   */
  const { data: customShows } = useCustomShows();

  const onMediaSourceChange = useCallback(
    (newMediaSourceId: string) => {
      if (newMediaSourceId === 'custom-shows') {
        // Not dealing with a server
        setProgrammingListLibrary({ type: 'custom-show' });
        setProgrammingListingServer(undefined);
        setMediaSource(newMediaSourceId);
      } else {
        const server = find(
          mediaSources,
          (source) => source.id === newMediaSourceId,
        );
        if (server) {
          setProgrammingListingServer(server);
          setMediaSource(server.name);
        }
      }
    },
    [mediaSources],
  );

  const onLibraryChange = useCallback(
    (libraryUuid: string) => {
      if (selectedServer?.type === 'plex') {
        const library = knownMedia.getMediaOfType(
          selectedServer.id,
          libraryUuid,
          'plex',
        );
        if (library && isPlexDirectory(library)) {
          setProgrammingListLibrary({ type: 'plex', library });
        }
      } else if (selectedServer?.type === 'jellyfin') {
        const library = knownMedia.getMediaOfType(
          selectedServer.id,
          libraryUuid,
          'jellyfin',
        );
        if (library) {
          setProgrammingListLibrary({ type: 'jellyfin', library });
        }
      }
    },
    [knownMedia, selectedServer],
  );

  const renderMediaSourcePrograms = () => {
    if (selectedLibrary) {
      switch (selectedLibrary.type) {
        case 'plex':
          return <PlexProgrammingSelector />;
        case 'jellyfin':
          return <JellyfinProgrammingSelector />;
        case 'custom-show':
          return <CustomShowProgrammingSelector />;
      }
    }

    // TODO: change the wording here to not be Plex-specific
    if (!mediaSourcesLoading && !selectedServer) {
      return (
        <>
          <Typography variant="h6" fontWeight={600} align="left" sx={{ mt: 3 }}>
            Connect Plex
          </Typography>
          <Typography sx={{ mb: 3 }} align="left">
            To use Tunarr, you need to first connect your Plex library. This
            will allow you to build custom channels with any of your plex
            content.
          </Typography>

          <Alert
            variant="filled"
            severity="error"
            action={<AddPlexServer title={'Connect Plex'} variant="outlined" />}
          >
            Plex is not connected.
          </Alert>
        </>
      );
    }

    return null;
  };

  const renderLibraryChoices = () => {
    if (isUndefined(selectedServer)) {
      return;
    }

    switch (selectedServer.type) {
      case 'plex': {
        return (
          !isNil(plexLibraryChildren) &&
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
          )
        );
      }
      case 'jellyfin': {
        return (
          !isNil(jellyfinLibraries) &&
          jellyfinLibraries.Items.length > 0 &&
          selectedJellyfinLibrary && (
            <FormControl size="small" sx={{ minWidth: { sm: 200 } }}>
              <InputLabel>Library</InputLabel>
              <Select
                label="Library"
                value={selectedJellyfinLibrary.Id}
                onChange={(e) => onLibraryChange(e.target.value)}
              >
                {chain(jellyfinLibraries.Items)
                  .sortBy(sortJellyfinLibraries)
                  .map((lib) => (
                    <MenuItem key={lib.Id} value={lib.Id}>
                      {lib.Name}
                    </MenuItem>
                  ))
                  .value()}
              </Select>
            </FormControl>
          )
        );
      }
    }
  };

  const hasAnySources =
    (mediaSources && mediaSources.length > 0) || customShows.length > 0;

  return (
    <Box>
      <Box sx={{ p: 1 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          sx={{
            display: 'flex',
            columnGap: 1,
            justifyContent: 'flex-start',
            flexGrow: 1,
            rowGap: 2,
          }}
        >
          {hasAnySources && (
            <FormControl size="small" sx={{ minWidth: { sm: 200 } }}>
              <InputLabel>Media Source</InputLabel>
              <Select
                label="Media Source"
                value={
                  viewingCustomShows ? 'custom-shows' : selectedServer?.id ?? ''
                }
                onChange={(e) => onMediaSourceChange(e.target.value)}
              >
                {map(mediaSources, (server) => (
                  <MenuItem key={server.id} value={server.id}>
                    {capitalize(server.type)}: {server.name}
                  </MenuItem>
                ))}
                {customShows.length > 0 && (
                  <MenuItem value="custom-shows">Custom Shows</MenuItem>
                )}
              </Select>
            </FormControl>
          )}

          {renderLibraryChoices()}
        </Stack>
        {renderMediaSourcePrograms()}
      </Box>
    </Box>
  );
}
