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
import { isNonEmptyString } from '@tunarr/shared/util';
import type { SearchRequest } from '@tunarr/types/api';
import {
  capitalize,
  find,
  isEmpty,
  isUndefined,
  map,
  orderBy,
  some,
} from 'lodash-es';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Emby,
  Imported,
  Jellyfin,
  Local,
  Plex,
} from '../../helpers/constants.ts';
import { useMediaSourceLibraries } from '../../hooks/media-sources/useMediaSourceLibraries.ts';
import { useMediaSources } from '../../hooks/settingsHooks.ts';
import { useCustomShows } from '../../hooks/useCustomShows.ts';
import { useProgrammingSelectionContext } from '../../hooks/useProgrammingSelectionContext.ts';
import useStore from '../../store/index.ts';
import {
  setProgrammingListLibrary,
  setProgrammingListingServer,
} from '../../store/programmingSelector/actions.ts';
import { ProgramViewToggleButton } from '../base/ProgramViewToggleButton.tsx';
import { RouterLink } from '../base/RouterLink.tsx';
import { LibrarySearch } from '../library/LibrarySearch.tsx';
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
  initialSearchRequest?: SearchRequest;
  toggleOrSetSelectedProgramsDrawer: (open: boolean) => void;
};

export const ProgrammingSelector = ({
  initialMediaSourceId,
  initialLibraryId,
  toggleOrSetSelectedProgramsDrawer,
}: Props) => {
  const { entityType, onSourceChange } = useProgrammingSelectionContext();
  const { data: mediaSources, isLoading: mediaSourcesLoading } =
    useMediaSources();
  const sortedMediaSources = useMemo(
    () =>
      orderBy(
        mediaSources,
        (ms) => (ms.libraries.some((lib) => lib.lastScannedAt) ? 0 : 1),
        'asc',
      ),
    [mediaSources],
  );
  const selectedServer = useStore((s) => s.currentMediaSource);
  const selectedLibrary = useStore((s) => s.currentMediaSourceView);
  const [mediaSource, setMediaSource] = useState(selectedServer?.name);
  const [useSyncedSources, setUseSyncedSources] = useState(true);
  const viewingCustomShows = mediaSource === 'custom-shows';

  const { data: libraries, isLoading: librariesLoading } =
    useMediaSourceLibraries(selectedServer?.id ?? '', {
      enabled:
        isNonEmptyString(selectedServer?.id) && selectedServer.type !== 'local',
    });

  useEffect(() => {
    const server =
      !isUndefined(mediaSources) && !isEmpty(mediaSources)
        ? (find(mediaSources, ({ id }) => id === initialMediaSourceId) ??
          sortedMediaSources[0])
        : undefined;

    setProgrammingListingServer(server);
  }, [initialMediaSourceId, mediaSources, sortedMediaSources]);

  /**
   * Load custom shows
   */
  const { data: customShows } = useCustomShows();

  const handleMediaSourceChange = useCallback(
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
          onSourceChange({ mediaSourceId: server.id });
        }
      }
    },
    [mediaSources, onSourceChange],
  );

  const renderMediaSourcePrograms = () => {
    const noSyncedLibraries =
      selectedServer?.type !== 'local' &&
      useSyncedSources &&
      !librariesLoading &&
      !some(libraries, (lib) => lib.enabled && !!lib.lastScannedAt);

    if (noSyncedLibraries) {
      return (
        <Alert severity="error">
          This media source has no enabled or scanned libraries. Enable
          libraries for this source on the{' '}
          <RouterLink to="/settings/sources">Media Sources</RouterLink> page or
          manually trigger scans on the{' '}
          <RouterLink to="/library">Library</RouterLink> page.
        </Alert>
      );
    }

    if (selectedServer?.type === 'local') {
      return (
        <Box sx={{ mt: 2 }}>
          <LibrarySearch
            mediaSource={selectedServer}
            disableProgramSelection={false}
            toggleOrSetSelectedProgramsDrawer={
              toggleOrSetSelectedProgramsDrawer
            }
          />
        </Box>
      );
    }

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
              <LibrarySearch
                mediaSource={selectedServer}
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
        default:
          return null;
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
      case Local:
        return null;
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
                onChange={(e) => handleMediaSourceChange(e.target.value)}
              >
                {map(sortedMediaSources, (server) => (
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
          {selectedServer?.type !== 'local' && (
            <FormControlLabel
              control={
                <Switch
                  checked={useSyncedSources}
                  onChange={(_, v) => setUseSyncedSources(v)}
                />
              }
              label="Show only synced"
            />
          )}
          <ProgramViewToggleButton sx={{ ml: 'auto' }} />
        </Stack>
      </Box>
      {renderMediaSourcePrograms()}
    </Box>
  );
};
