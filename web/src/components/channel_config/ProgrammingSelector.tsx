import { useJellyfinUserLibraries } from '@/hooks/jellyfin/useJellyfinApi.ts';
import { useKnownMedia } from '@/store/programmingSelector/selectors.ts';
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
import { tag } from '@tunarr/types';
import { type JellyfinItem } from '@tunarr/types/jellyfin';
import { type PlexMedia, isPlexDirectory } from '@tunarr/types/plex';
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
import {
  usePlexLibraries,
  usePlexPlaylists,
} from '../../hooks/plex/usePlex.ts';
import { useMediaSources } from '../../hooks/settingsHooks.ts';
import { useCustomShows } from '../../hooks/useCustomShows.ts';
import { useProgrammingSelectionContext } from '../../hooks/useProgrammingSelectionContext.ts';
import useStore from '../../store/index.ts';
import {
  addKnownMediaForJellyfinServer,
  addKnownMediaForPlexServer,
  setProgrammingListLibrary,
  setProgrammingListingServer,
} from '../../store/programmingSelector/actions.ts';
import { AddMediaSourceButton } from '../settings/media_source/AddMediaSourceButton.tsx';
import { CustomShowProgrammingSelector } from './CustomShowProgrammingSelector.tsx';
import { JellyfinProgrammingSelector } from './JellyfinProgrammingSelector.tsx';
import PlexProgrammingSelector from './PlexProgrammingSelector.tsx';

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

export default function ProgrammingSelector(_: Props) {
  const { entityType } = useProgrammingSelectionContext();
  const { data: mediaSources, isLoading: mediaSourcesLoading } =
    useMediaSources();
  const selectedServer = useStore((s) => s.currentMediaSource);
  const selectedLibrary = useStore((s) => s.currentMediaSourceView);
  const knownMedia = useKnownMedia();
  const [mediaSource, setMediaSource] = useState(selectedServer?.name);

  // Convenience sub-selectors for specific library types
  const selectedPlexLibrary =
    selectedLibrary?.type === 'plex' ? selectedLibrary.view : undefined;
  const selectedJellyfinLibrary =
    selectedLibrary?.type === 'jellyfin' ? selectedLibrary.library : undefined;

  const viewingCustomShows = mediaSource === 'custom-shows';

  const { data: plexLibraryChildren } = usePlexLibraries(
    selectedServer?.id ?? tag(''),
    selectedServer?.type === 'plex',
  );

  const { data: plexPlaylists, isLoading: plexPlaylistsLoading } =
    usePlexPlaylists(
      selectedServer?.id ?? tag(''),
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
      if (
        plexLibraryChildren.size > 0 &&
        (!selectedLibrary || selectedLibrary.type !== 'plex')
      ) {
        setProgrammingListLibrary({
          type: 'plex',
          view: {
            type: 'library',
            library: plexLibraryChildren.Directory[0],
          },
        });
      }
      addKnownMediaForPlexServer(selectedServer.id, [
        ...plexLibraryChildren.Directory,
      ]);
    } else if (selectedServer?.type === 'jellyfin' && jellyfinLibraries) {
      if (
        jellyfinLibraries.Items.length > 0 &&
        (!selectedLibrary || selectedLibrary.type !== 'jellyfin')
      ) {
        setProgrammingListLibrary({
          type: 'jellyfin',
          library: sortBy(jellyfinLibraries.Items, sortJellyfinLibraries)[0],
        });
      }
      addKnownMediaForJellyfinServer(selectedServer.id, [
        ...jellyfinLibraries.Items,
      ]);
    }
  }, [selectedServer, plexLibraryChildren, jellyfinLibraries, selectedLibrary]);

  /**
   * Load custom shows
   */
  const { data: customShows } = useCustomShows();

  const onMediaSourceChange = useCallback(
    (newMediaSourceId: string) => {
      if (newMediaSourceId === 'custom-shows') {
        // Not dealing with a server
        setProgrammingListingServer(undefined);
        setProgrammingListLibrary({ type: 'custom-show' });
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
        if (libraryUuid === 'playlists' && plexPlaylists) {
          setProgrammingListLibrary({
            type: 'plex',
            view: { type: 'playlists', playlists: plexPlaylists },
          });
          return;
        }

        const library = knownMedia.getPlexMedia(selectedServer.id, libraryUuid);

        if (library && isPlexDirectory(library)) {
          setProgrammingListLibrary({
            type: 'plex',
            view: { type: 'library', library },
          });
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
    [knownMedia, plexPlaylists, selectedServer?.id, selectedServer?.type],
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

    if (!mediaSourcesLoading && !selectedServer && !viewingCustomShows) {
      return (
        <>
          <Typography variant="h6" fontWeight={600} align="left" sx={{ mt: 3 }}>
            Connect Media Source
          </Typography>
          <Typography sx={{ mb: 3 }} align="left">
            To use Tunarr, you need to first connect a Plex or Jellyfin library.
            This will allow you to build custom channels with your content.
          </Typography>

          <Alert
            variant="filled"
            severity="error"
            action={<AddMediaSourceButton />}
          >
            No Media Sources detected.
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
        const hasLibraries =
          !isNil(plexLibraryChildren) &&
          plexLibraryChildren.size > 0 &&
          selectedPlexLibrary;

        const libraryMenuItems = map(plexLibraryChildren?.Directory, (dir) => (
          <MenuItem key={dir.key} value={dir.uuid}>
            {dir.title}
          </MenuItem>
        ));

        const playlistMenuItem = (
          <MenuItem
            key="playlists"
            value="playlists"
            disabled={plexPlaylistsLoading}
          >
            Playlists
          </MenuItem>
        );

        return (
          hasLibraries && (
            <FormControl size="small" sx={{ minWidth: { sm: 200 } }}>
              <InputLabel>Library</InputLabel>
              <Select
                label="Library"
                value={
                  selectedPlexLibrary.type === 'library'
                    ? selectedPlexLibrary.library.uuid
                    : 'playlists'
                }
                onChange={(e) => onLibraryChange(e.target.value)}
              >
                {libraryMenuItems}
                {playlistMenuItem}
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

  const hasAnySources = !isEmpty(mediaSources) || !isEmpty(customShows);

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
                {entityType !== 'custom-show' && customShows.length > 0 && (
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
