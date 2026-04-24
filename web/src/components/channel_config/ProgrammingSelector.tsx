import { Trans, useLingui } from '@lingui/react/macro';
import { Keyboard, Mouse } from '@mui/icons-material';
import {
  Alert,
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import type { MediaSourceId } from '@tunarr/shared';
import { isNonEmptyString } from '@tunarr/shared/util';
import { tag } from '@tunarr/types';
import type { SearchRequest } from '@tunarr/types/schemas';
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
import { Imported } from '../../helpers/constants.ts';
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
import { LibraryProgramGrid } from '../library/LibraryProgramGrid.tsx';
import { SearchInput } from '../search/SearchInput.tsx';
import { AddMediaSourceButton } from '../settings/media_source/AddMediaSourceButton.tsx';
import { CustomShowProgrammingSelector } from './CustomShowProgrammingSelector.tsx';
import { ImportedLibrarySelector } from './ImportedLibrarySeletor.tsx';
import SelectedProgrammingActions from './SelectedProgrammingActions.tsx';

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
  const { t } = useLingui();
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
  const [queryBuilderType, setQueryBuilderType] = useState<'text' | 'click'>(
    'text',
  );
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
      !librariesLoading &&
      !some(libraries, (lib) => lib.enabled && !!lib.lastScannedAt);

    if (noSyncedLibraries) {
      return (
        <Alert severity="error">
          <Trans>
            This media source has no enabled or scanned libraries. Enable
            libraries for this source on the{' '}
            <RouterLink to="/settings/sources">Media Sources</RouterLink> page
            or manually trigger scans on the{' '}
            <RouterLink to="/library">Library</RouterLink> page.
          </Trans>
        </Alert>
      );
    }

    if (selectedServer?.type === 'local') {
      return (
        <Box sx={{ mt: 2 }}>
          <SearchInput mediaSourceId={tag<MediaSourceId>(selectedServer.id)} />
          <SelectedProgrammingActions
            toggleOrSetSelectedProgramsDrawer={
              toggleOrSetSelectedProgramsDrawer
            }
          />
          <LibraryProgramGrid mediaSource={selectedServer} />
        </Box>
      );
    }

    switch (selectedLibrary?.type) {
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
          <Stack gap={2}>
            <SearchInput
              mediaSourceId={tag<MediaSourceId>(selectedServer!.id)}
              libraryId={selectedLibrary.view.id}
            />
            <SelectedProgrammingActions
              toggleOrSetSelectedProgramsDrawer={
                toggleOrSetSelectedProgramsDrawer
              }
            />
            <LibraryProgramGrid
              mediaSource={selectedServer}
              library={{
                ...selectedLibrary.view,
                mediaSource: selectedServer!,
              }}
            />
          </Stack>
        );
      default:
        break;
    }

    if (!mediaSourcesLoading && !selectedServer && !viewingCustomShows) {
      return (
        <>
          <Typography variant="h6" fontWeight={600} align="left" sx={{ mt: 3 }}>
            <Trans>Connect Media Source</Trans>
          </Typography>
          <Typography sx={{ mb: 3 }} align="left">
            <Trans>
              To use Tunarr, you need to first connect a media source. This will
              allow you to build custom channels with your content.
            </Trans>
          </Typography>

          <Alert
            variant="filled"
            severity="error"
            action={
              <AddMediaSourceButton
                ButtonProps={{ color: 'inherit', variant: 'outlined' }}
              />
            }
          >
            <Trans>No Media Sources detected.</Trans>
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

    return <ImportedLibrarySelector initialLibraryId={initialLibraryId} />;
  };

  const hasAnySources = !isEmpty(mediaSources) || !isEmpty(customShows);

  return (
    <Box>
      <Box sx={{ pb: 1 }}>
        <Stack
          direction={{ sm: 'column', md: 'row' }}
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            columnGap: 2,
            justifyContent: 'flex-start',
            flexGrow: 1,
            rowGap: { sm: 1, md: 0 },
            alignItems: 'center',
          }}
        >
          {hasAnySources && (
            <FormControl size="small" sx={{ minWidth: { sm: 200 } }}>
              <InputLabel>{t`Media Source`}</InputLabel>
              <Select
                label={t`Media Source`}
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
                  <MenuItem value="custom-shows">
                    <Trans>Custom Shows</Trans>
                  </MenuItem>
                )}
              </Select>
            </FormControl>
          )}

          {renderLibraryChoices()}

          {selectedLibrary?.type === 'imported' && (
            <ToggleButtonGroup
              value={queryBuilderType}
              onChange={(_, v) => {
                if (v) {
                  setQueryBuilderType(v as 'text' | 'click');
                }
              }}
              exclusive
            >
              <ToggleButton value="text">
                <Keyboard />
              </ToggleButton>
              <ToggleButton value="click">
                <Mouse />
              </ToggleButton>
            </ToggleButtonGroup>
          )}
          <ProgramViewToggleButton sx={{ ml: { sm: undefined, md: 'auto' } }} />
          <Box sx={{ flexBasis: '100%' }} />
        </Stack>
      </Box>
      {renderMediaSourcePrograms()}
    </Box>
  );
};
