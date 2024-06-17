import { Delete, DoneAll, Grading } from '@mui/icons-material';
import { Button, Paper, Tooltip, useMediaQuery, useTheme } from '@mui/material';
import { useCallback, useState } from 'react';
import useStore from '../../store/index.ts';
import {
  addKnownMediaForServer,
  addPlexSelectedMedia,
  clearSelectedMedia,
} from '../../store/programmingSelector/actions.ts';
import { AddedMedia } from '../../types/index.ts';
import { isNil } from 'lodash-es';
import { useDirectPlexSearch } from '@/hooks/plex/usePlexSearch.ts';
import { RotatingLoopIcon } from '../base/LoadingIcon.tsx';
import AddSelectedMediaButton from './AddSelectedMediaButton.tsx';
import { useSnackbar } from 'notistack';

type Props = {
  onAddSelectedMedia: (media: AddedMedia[]) => void;
  onAddMediaSuccess: () => void;
  toggleOrSetSelectedProgramsDrawer: (open?: boolean) => void;
  onSelectionModalClose?: () => void;
  selectAllEnabled?: boolean;
};

export default function SelectedProgrammingActions({
  onAddSelectedMedia,
  onAddMediaSuccess,
  selectAllEnabled = true,
  toggleOrSetSelectedProgramsDrawer, // onSelectionModalClose,
}: Props) {
  const [selectedServer, selectedLibrary] = useStore((s) => [
    s.currentServer,
    s.currentLibrary?.type === 'plex' ? s.currentLibrary : null,
  ]);

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
    selectedLibrary,
    plexSearch,
    true,
  );

  const selectAllItems = () => {
    if (
      !isNil(selectedServer) &&
      !isNil(selectedLibrary) &&
      selectedLibrary.type === 'plex'
    ) {
      setSelectAllLoading(true);
      directPlexSearchFn()
        .then((response) => {
          addKnownMediaForServer(selectedServer.name, response.Metadata ?? []);
          addPlexSelectedMedia(selectedServer.name, response.Metadata);
        })
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
              border: `1px solid ${theme.palette.primary.contrastText}`,
              borderRadius: '10px',
            }}
          />
        )}
      </Paper>
    </>
  );
}
