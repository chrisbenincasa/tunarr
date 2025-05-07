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
import { isPlexDirectory } from '@tunarr/types/plex';
import {
  capitalize,
  chain,
  find,
  first,
  isEmpty,
  isNil,
  isUndefined,
  map,
  sortBy,
} from 'lodash-es';
import { useCallback, useEffect, useState } from 'react';
import { Emby, Jellyfin, Plex } from '../../helpers/constants.ts';
import { sortEmbyLibraries } from '../../helpers/embyUtil.ts';
import { sortJellyfinLibraries } from '../../helpers/jellyfinUtil.ts';
import { useEmbyUserLibraries } from '../../hooks/emby/useEmbyApi.ts';
import {
  usePlexLibraries,
  usePlexPlaylists,
} from '../../hooks/plex/usePlex.ts';
import { useMediaSources } from '../../hooks/settingsHooks.ts';
import { useCustomShows } from '../../hooks/useCustomShows.ts';
import { useProgrammingSelectionContext } from '../../hooks/useProgrammingSelectionContext.ts';
import { Route } from '../../routes/channels_/$channelId/programming/add.tsx';
import useStore from '../../store/index.ts';
import {
  addKnownMediaForEmbyServer,
  addKnownMediaForJellyfinServer,
  addKnownMediaForPlexServer,
  setProgrammingListLibrary,
  setProgrammingListingServer,
} from '../../store/programmingSelector/actions.ts';
import { AddMediaSourceButton } from '../settings/media_source/AddMediaSourceButton.tsx';
import { CustomShowProgrammingSelector } from './CustomShowProgrammingSelector.tsx';
import { EmbyProgrammingSelector } from './EmbyProgrammingSelector.tsx';
import { JellyfinProgrammingSelector } from './JellyfinProgrammingSelector.tsx';
import PlexProgrammingSelector from './PlexProgrammingSelector.tsx';

type Props = {
  initialMediaSourceId?: string;
  initialLibraryId?: string;
  toggleOrSetSelectedProgramsDrawer: (open: boolean) => void;
};

export default function ProgrammingSelector({
  initialMediaSourceId,
  toggleOrSetSelectedProgramsDrawer,
}: Props) {
  const { entityType } = useProgrammingSelectionContext();
  const { data: mediaSources, isLoading: mediaSourcesLoading } =
    useMediaSources();
  const selectedServer = useStore((s) => s.currentMediaSource);
  const selectedLibrary = useStore((s) => s.currentMediaSourceView);
  const knownMedia = useKnownMedia();
  const [mediaSource, setMediaSource] = useState(selectedServer?.name);
  const navigate = Route.useNavigate();

  // Convenience sub-selectors for specific library types
  const selectedPlexLibrary =
    selectedLibrary?.type === Plex ? selectedLibrary.view : undefined;
  const selectedJellyfinLibrary =
    selectedLibrary?.type === Jellyfin ? selectedLibrary.view : undefined;
  const selectedEmbyLibrary =
    selectedLibrary?.type === Emby ? selectedLibrary.view : undefined;

  const viewingCustomShows = mediaSource === 'custom-shows';

  const { data: plexLibraryChildren } = usePlexLibraries(
    selectedServer?.id ?? tag(''),
    selectedServer?.type === Plex,
  );

  const { data: plexPlaylists, isLoading: plexPlaylistsLoading } =
    usePlexPlaylists(
      selectedServer?.id ?? tag(''),
      selectedServer?.type === Plex,
    );

  const { data: jellyfinLibraries } = useJellyfinUserLibraries(
    selectedServer?.id ?? '',
    selectedServer?.type === Jellyfin,
  );

  const { data: embyLibraries } = useEmbyUserLibraries(
    selectedServer?.id ?? '',
    selectedServer?.type === Emby,
  );

  useEffect(() => {
    const server =
      !isUndefined(mediaSources) && !isEmpty(mediaSources)
        ? mediaSources[0]
        : undefined;

    setProgrammingListingServer(server);
  }, [mediaSources]);

  useEffect(() => {
    if (selectedServer?.type === Plex && plexLibraryChildren) {
      if (
        plexLibraryChildren.size > 0 &&
        (!selectedLibrary || selectedLibrary.type !== Plex)
      ) {
        setProgrammingListLibrary({
          type: Plex,
          view: {
            type: 'library',
            library: plexLibraryChildren.Directory[0],
          },
        });
        navigate({
          search: {
            libraryId: plexLibraryChildren.Directory[0].uuid,
            mediaSourceId: selectedServer.id,
          },
        }).catch(console.error);
      }
      addKnownMediaForPlexServer(selectedServer.id, [
        ...plexLibraryChildren.Directory,
      ]);
    } else if (selectedServer?.type === Jellyfin && jellyfinLibraries) {
      if (
        jellyfinLibraries.Items.length > 0 &&
        (!selectedLibrary || selectedLibrary.type !== Jellyfin)
      ) {
        const view = sortBy(jellyfinLibraries.Items, sortJellyfinLibraries)[0];
        setProgrammingListLibrary({
          type: Jellyfin,
          view,
        });
        navigate({
          search: {
            libraryId: view.Id,
            mediaSourceId: selectedServer.id,
          },
        }).catch(console.error);
      }
      addKnownMediaForJellyfinServer(selectedServer.id, [
        ...jellyfinLibraries.Items,
      ]);
    } else if (selectedServer?.type === Emby && embyLibraries) {
      if (
        embyLibraries.Items.length > 0 &&
        (!selectedLibrary || selectedLibrary.type !== Emby)
      ) {
        setProgrammingListLibrary({
          type: Emby,
          view: first(sortBy(embyLibraries.Items, sortEmbyLibraries))!,
        });
      }
      addKnownMediaForEmbyServer(selectedServer.id, embyLibraries.Items);
    }
  }, [
    selectedServer,
    plexLibraryChildren,
    jellyfinLibraries,
    selectedLibrary,
    embyLibraries,
    navigate,
  ]);

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
      if (selectedServer?.type === Plex) {
        if (libraryUuid === 'playlists' && plexPlaylists) {
          setProgrammingListLibrary({
            type: Plex,
            view: { type: 'playlists', playlists: plexPlaylists },
          });
          return;
        }

        const library = knownMedia.getPlexMedia(selectedServer.id, libraryUuid);

        if (library && isPlexDirectory(library)) {
          setProgrammingListLibrary({
            type: Plex,
            view: { type: 'library', library },
          });
        }
      } else if (selectedServer?.type === Jellyfin) {
        const view = knownMedia.getMediaOfType(
          selectedServer.id,
          libraryUuid,
          Jellyfin,
        );
        if (view) {
          setProgrammingListLibrary({ type: Jellyfin, view });
        }
      } else if (selectedServer?.type === Emby) {
        const view = knownMedia.getMediaOfType(
          selectedServer.id,
          libraryUuid,
          Emby,
        );
        if (view) {
          setProgrammingListLibrary({ type: Emby, view });
        }
      }
    },
    [knownMedia, plexPlaylists, selectedServer?.id, selectedServer?.type],
  );

  const renderMediaSourcePrograms = () => {
    if (selectedLibrary) {
      switch (selectedLibrary.type) {
        case Plex:
          return (
            <PlexProgrammingSelector
              toggleOrSetSelectedProgramsDrawer={
                toggleOrSetSelectedProgramsDrawer
              }
            />
          );
        case Jellyfin:
          return (
            <JellyfinProgrammingSelector
              toggleOrSetSelectedProgramsDrawer={
                toggleOrSetSelectedProgramsDrawer
              }
            />
          );
        case Emby:
          return (
            <EmbyProgrammingSelector
              toggleOrSetSelectedProgramsDrawer={
                toggleOrSetSelectedProgramsDrawer
              }
            />
          );
        case 'custom-show':
          return (
            <CustomShowProgrammingSelector
              toggleOrSetSelectedProgramsDrawer={
                toggleOrSetSelectedProgramsDrawer
              }
            />
          );
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
      case Plex: {
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
      case Jellyfin: {
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
      case Emby: {
        return (
          !isNil(embyLibraries) &&
          embyLibraries.Items.length > 0 &&
          selectedEmbyLibrary && (
            <FormControl size="small" sx={{ minWidth: { sm: 200 } }}>
              <InputLabel>Library</InputLabel>
              <Select
                label="Library"
                value={selectedEmbyLibrary.Id}
                onChange={(e) => onLibraryChange(e.target.value)}
              >
                {chain(embyLibraries.Items)
                  .sortBy(sortEmbyLibraries)
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
                  viewingCustomShows
                    ? 'custom-shows'
                    : (initialMediaSourceId ?? selectedServer?.id ?? '')
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
