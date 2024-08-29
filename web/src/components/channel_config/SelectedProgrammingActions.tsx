import { useDirectPlexSearch } from '@/hooks/plex/usePlexSearch.ts';
import { useTunarrApi } from '@/hooks/useTunarrApi.ts';
import { useCurrentMediaSourceAndLibrary } from '@/store/programmingSelector/selectors.ts';
import {
  JellyfinLibrary,
  PlexLibrary,
} from '@/store/programmingSelector/store.ts';
import { Delete, DoneAll, Grading } from '@mui/icons-material';
import { Button, Paper, Tooltip, useMediaQuery, useTheme } from '@mui/material';
import { isNil } from 'lodash-es';
import { useSnackbar } from 'notistack';
import { useCallback, useState } from 'react';
import useStore from '../../store/index.ts';
import {
  addJellyfinSelectedMedia,
  addKnownMediaForServer,
  addPlexSelectedMedia,
  clearSelectedMedia,
} from '../../store/programmingSelector/actions.ts';
import { AddedMedia } from '../../types/index.ts';
import { RotatingLoopIcon } from '../base/LoadingIcon.tsx';
import AddSelectedMediaButton from './AddSelectedMediaButton.tsx';
import {
  JellyfinItemKind,
  JellyfinCollectionType,
} from '@tunarr/types/jellyfin';
import { nullToUndefined } from '@tunarr/shared/util';

type Props = {
  onAddSelectedMedia: (media: AddedMedia[]) => void;
  onAddMediaSuccess: () => void;
  toggleOrSetSelectedProgramsDrawer: (open?: boolean) => void;
  onSelectionModalClose?: () => void;
  selectAllEnabled?: boolean;
};

function collectionTypeToItemTypes(
  collectionType?: JellyfinCollectionType,
): JellyfinItemKind[] {
  if (!collectionType) {
    return ['Movie', 'Series', 'MusicArtist'];
  }

  switch (collectionType) {
    case 'movies':
      return ['Movie'];
    case 'tvshows':
      return ['Series'];
    case 'music':
      return ['MusicArtist'];
    default:
      return ['Movie', 'Series', 'MusicArtist'];
  }
}

export default function SelectedProgrammingActions({
  onAddSelectedMedia,
  onAddMediaSuccess,
  selectAllEnabled = true,
  toggleOrSetSelectedProgramsDrawer, // onSelectionModalClose,
}: Props) {
  const apiClient = useTunarrApi();
  const [selectedServer, selectedLibrary] = useCurrentMediaSourceAndLibrary();

  const { urlFilter: plexSearch } = useStore(
    ({ plexSearch: plexQuery }) => plexQuery,
  );

  const selectedMedia = useStore((s) => s.selectedMedia);
  const theme = useTheme();
  const smallViewport = useMediaQuery(theme.breakpoints.down('sm'));
  const [selectAllLoading, setSelectAllLoading] = useState(false);
  const snackbar = useSnackbar();

  const removeAllItems = useCallback(() => {
    toggleOrSetSelectedProgramsDrawer(false);
    clearSelectedMedia();
  }, [toggleOrSetSelectedProgramsDrawer]);

  const directPlexSearchFn = useDirectPlexSearch(
    selectedServer,
    selectedServer?.type === 'plex' ? (selectedLibrary as PlexLibrary) : null,
    plexSearch,
    true,
  );

  const selectAllItems = () => {
    if (!isNil(selectedServer) && !isNil(selectedLibrary)) {
      setSelectAllLoading(true);
      let prom: Promise<void>;
      switch (selectedServer.type) {
        case 'plex':
          prom = directPlexSearchFn().then((response) => {
            addPlexSelectedMedia(selectedServer, response.Metadata);
            addKnownMediaForServer(selectedServer.id, {
              type: 'plex' as const,
              items: response.Metadata ?? [],
            });
          });
          break;
        case 'jellyfin': {
          const library = selectedLibrary as JellyfinLibrary;

          prom = apiClient
            .getJellyfinItems({
              params: {
                mediaSourceId: selectedServer.id,
                libraryId: library.library.Id,
              },
              queries: {
                // offset: pageParams?.offset,
                // limit: pageParams?.limit,
                itemTypes: collectionTypeToItemTypes(
                  nullToUndefined(library.library.CollectionType),
                ),
              },
            })
            .then((response) => {
              addJellyfinSelectedMedia(selectedServer, response.Items);
              addKnownMediaForServer(selectedServer.id, {
                type: 'jellyfin' as const,
                items: response.Items,
              });
            });
          break;
        }
      }

      prom
        .catch((e) => {
          console.error('Error while attempting to select all Plex items', e);
          snackbar.enqueueSnackbar(
            'Error querying Plex. Check console log and consider reporting a bug!',
            {
              variant: 'error',
            },
          );
        })
        .finally(() => setSelectAllLoading(false));
    }
  };

  return (
    <>
      <Paper
        elevation={2}
        sx={{
          borderRadius: '10px',
          backgroundColor: theme.palette.primary.main,
          color: theme.palette.primary.contrastText,
          position: 'fixed',
          bottom: smallViewport ? '3em' : '1em',
          width: 'fit-content',
          maxWidth: smallViewport ? '425px' : '525px',
          margin: '1em auto',
          left: 0,
          right: 0,
          display: 'flex',
          py: '5px',
          px: 1,
          justifyContent: 'space-evenly',
          zIndex: 2,
          gap: 1,
        }}
      >
        {selectedMedia.length > 0 && (
          <Tooltip
            title={smallViewport ? 'Unselect All' : 'Unselect all programs'}
          >
            <Button
              startIcon={smallViewport ? null : <Delete />}
              sx={{
                color: theme.palette.primary.contrastText,
                border: `1px solid ${theme.palette.primary.contrastText}`,
                borderRadius: '10px',
              }}
              onClick={() => removeAllItems()}
            >
              Clear
            </Button>
          </Tooltip>
        )}
        {selectAllEnabled && (
          <Tooltip title={smallViewport ? 'Select All' : 'Select all programs'}>
            <Button
              startIcon={
                smallViewport ? null : selectAllLoading ? (
                  <RotatingLoopIcon />
                ) : (
                  <DoneAll />
                )
              }
              disabled={selectAllLoading}
              sx={{
                color: theme.palette.primary.contrastText,
                border: `1px solid ${theme.palette.primary.contrastText}`,
                borderRadius: '10px',
              }}
              onClick={() => selectAllItems()}
            >
              Select All
            </Button>
          </Tooltip>
        )}

        {selectedMedia.length > 0 && (
          <Tooltip title="Review Selections">
            <Button
              startIcon={smallViewport ? null : <Grading />}
              sx={{
                color: theme.palette.primary.contrastText,
                border: `1px solid ${theme.palette.primary.contrastText}`,
                borderRadius: '10px',
              }}
              onClick={() => toggleOrSetSelectedProgramsDrawer()}
            >
              Review
            </Button>
          </Tooltip>
        )}

        {!smallViewport && (
          <AddSelectedMediaButton
            onAdd={onAddSelectedMedia}
            onSuccess={onAddMediaSuccess}
            sx={{
              color: theme.palette.primary.contrastText,
              border: `1px solid ${
                selectedMedia.length > 0
                  ? theme.palette.primary.contrastText
                  : theme.palette.action.disabled
              }`,
              borderRadius: '10px',
            }}
          />
        )}
      </Paper>
    </>
  );
}
