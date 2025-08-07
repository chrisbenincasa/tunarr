import {
  Alert,
  Box,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { capitalize, find, isEmpty, isUndefined, map } from 'lodash-es';
import { useCallback, useEffect, useState } from 'react';
import { Emby, Imported, Jellyfin, Plex } from '../../helpers/constants.ts';
import { useMediaSources } from '../../hooks/settingsHooks.ts';
import { useCustomShows } from '../../hooks/useCustomShows.ts';
import { useProgrammingSelectionContext } from '../../hooks/useProgrammingSelectionContext.ts';
import { Route } from '../../routes/channels_/$channelId/programming/add.tsx';
import useStore from '../../store/index.ts';
import {
  setProgrammingListLibrary,
  setProgrammingListingServer,
} from '../../store/programmingSelector/actions.ts';
import { ProgramViewToggleButton } from '../base/ProgramViewToggleButton.tsx';
import { LibraryProgramGrid } from '../library/LibraryProgramGrid.tsx';
import { AddMediaSourceButton } from '../settings/media_source/AddMediaSourceButton.tsx';
import { CustomShowProgrammingSelector } from './CustomShowProgrammingSelector.tsx';
import { EmbyLibrarySelector } from './emby/EmbyLibrarySelector.tsx';
import { EmbyProgrammingSelector } from './emby/EmbyProgrammingSelector.tsx';
import { ImportedLibrarySelector } from './ImportedLibrarySeletor.tsx';
import { JellyfinLibrarySelector } from './jellyfin/JellyfinLibrarySelector.tsx';
import { JellyfinProgrammingSelector } from './jellyfin/JellyfinProgrammingSelector.tsx';
import { PlexLibrarySelector } from './plex/PlexLibrarySelector.tsx';
import PlexProgrammingSelector from './plex/PlexProgrammingSelector.tsx';

type Props = {
  initialMediaSourceId?: string;
  initialLibraryId?: string;
  toggleOrSetSelectedProgramsDrawer: (open: boolean) => void;
};

export const ProgrammingSelector = ({
  initialMediaSourceId,
  initialLibraryId,
  toggleOrSetSelectedProgramsDrawer,
}: Props) => {
  const { entityType } = useProgrammingSelectionContext();
  const { data: mediaSources, isLoading: mediaSourcesLoading } =
    useMediaSources();
  const selectedServer = useStore((s) => s.currentMediaSource);
  const selectedLibrary = useStore((s) => s.currentMediaSourceView);
  const [mediaSource, setMediaSource] = useState(selectedServer?.name);
  const navigate = Route.useNavigate();
  const [useSyncedSources, setUseSyncedSources] = useState(true);
  const selectedImportedLibrary =
    selectedLibrary?.type === Imported ? selectedLibrary.view : undefined;
  const viewingCustomShows = mediaSource === 'custom-shows';

  useEffect(() => {
    const server =
      !isUndefined(mediaSources) && !isEmpty(mediaSources)
        ? (find(mediaSources, ({ id }) => id === initialMediaSourceId) ??
          mediaSources[0])
        : undefined;

    setProgrammingListingServer(server);
  }, [initialMediaSourceId, mediaSources]);

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
          navigate({
            search: {
              mediaSourceId: server.id,
              libraryId: undefined,
            },
          }).catch(console.error);
        }
      }
    },
    [mediaSources, navigate],
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
        case Imported:
          return (
            <Box sx={{ mt: 2 }}>
              <LibraryProgramGrid
                library={{
                  ...selectedLibrary.view,
                  mediaSource: selectedServer!,
                }}
                disableProgramSelection={false}
                toggleOrSetSelectedProgramsDrawer={
                  toggleOrSetSelectedProgramsDrawer
                }
              />
            </Box>
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
            To use Tunarr, you need to first connect a media source. This will
            allow you to build custom channels with your content.
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

    if (useSyncedSources) {
      // const libraries = selectedServer.libraries.filter((lib) => lib.enabled);
      // if (libraries.length === 0) {
      //   return;
      // }

      // const items = libraries.map((lib) => {
      //   return (
      //     <MenuItem key={lib.id} value={lib.id}>
      //       {lib.name}
      //     </MenuItem>
      //   );
      // });

      // return (
      //   <FormControl size="small" sx={{ minWidth: { sm: 200 } }}>
      //     <InputLabel>Library</InputLabel>
      //     <Select
      //       label="Library"
      //       value={selectedImportedLibrary?.id ?? libraries[0].id}
      //       onChange={(e) => onLibraryChange(e.target.value)}
      //     >
      //       {items}
      //     </Select>
      //   </FormControl>
      // );
      return <ImportedLibrarySelector initialLibraryId={initialLibraryId} />;
    }

    switch (selectedServer.type) {
      case Plex: {
        return <PlexLibrarySelector initialLibraryId={initialLibraryId} />;
      }
      case Jellyfin: {
        return <JellyfinLibrarySelector initialLibraryId={initialLibraryId} />;
      }
      case Emby: {
        return <EmbyLibrarySelector initialLibraryId={initialLibraryId} />;
      }
    }
  };

  const hasAnySources = !isEmpty(mediaSources) || !isEmpty(customShows);

  return (
    <Box>
      <Box sx={{ pb: 1 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          sx={{
            display: 'flex',
            columnGap: 1,
            justifyContent: 'flex-start',
            flexGrow: 1,
            rowGap: 2,
            alignItems: 'center',
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
                    : (selectedServer?.id ?? '')
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
          <FormControlLabel
            control={
              <Switch
                checked={useSyncedSources}
                onChange={(_, v) => setUseSyncedSources(v)}
              />
            }
            label="Show only synced"
          />
          <ProgramViewToggleButton sx={{ ml: 'auto' }} />
        </Stack>
      </Box>
      {renderMediaSourcePrograms()}
    </Box>
  );
};
