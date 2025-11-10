import {
  FindReplace,
  Movie,
  MusicNote,
  MusicVideo,
  Refresh,
  Tv,
  VideoChat,
} from '@mui/icons-material';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Switch,
  Tooltip,
} from '@mui/material';
import { prettifySnakeCaseString } from '@tunarr/shared/util';
import type { MediaSourceLibrary } from '@tunarr/types';
import { type MediaSourceSettings } from '@tunarr/types';
import { isNil } from 'lodash-es';
import {
  useScanLibraryMutation,
  useUpdateLibraryMutation,
} from '../../../hooks/media-sources/mediaSourceLibraryHooks.ts';
import { useMediaSourceLibraries } from '../../../hooks/media-sources/useMediaSourceLibraries.ts';
import { useDayjs } from '../../../hooks/useDayjs.ts';
import type { Nullable } from '../../../types/util.ts';

type Props = {
  mediaSource: Nullable<MediaSourceSettings>;
  open: boolean;
  onClose: () => void;
};

export const EditMediaSourceLibrariesDialog = ({
  mediaSource,
  open,
  onClose,
}: Props) => {
  const dayjs = useDayjs();
  const { data: libraries } = useMediaSourceLibraries(mediaSource?.id ?? '', {
    enabled: !isNil(mediaSource),
  });

  const updateLibraryMutation = useUpdateLibraryMutation();
  const refreshLibraryMutation = useScanLibraryMutation();

  const updateLibraryEnabled = (libraryId: string, enabled: boolean) => {
    if (!mediaSource) {
      return;
    }

    updateLibraryMutation.mutate({
      path: {
        id: mediaSource.id,
        libraryId,
      },
      body: {
        enabled,
      },
    });
  };

  if (!mediaSource) {
    return null;
  }

  function getIconForLibraryType(typ: MediaSourceLibrary['mediaType']) {
    switch (typ) {
      case 'movies':
        return <Movie />;
      case 'shows':
        return <Tv />;
      case 'tracks':
        return <MusicNote />;
      case 'other_videos':
        return <VideoChat />;
      case 'music_videos':
        return <MusicVideo />;
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Manage Libraries</DialogTitle>
      <DialogContent>
        <List
          sx={{ width: '100%' }}
          subheader={
            <ListSubheader sx={{ backgroundColor: 'inherit' }}>
              Libraries
            </ListSubheader>
          }
        >
          {libraries?.map((library) => (
            <ListItem key={library.id}>
              <ListItemIcon>
                {getIconForLibraryType(library.mediaType)}
              </ListItemIcon>
              <ListItemText
                secondary={prettifySnakeCaseString(library.mediaType)}
              >
                {library.name}
              </ListItemText>
              {library.enabled && (
                <Tooltip
                  placement="top"
                  title={`Last Scanned: ${library.lastScannedAt ? dayjs(library.lastScannedAt)?.format() : 'never'}`}
                >
                  <span>
                    <IconButton
                      disabled={library.isLocked}
                      onClick={() =>
                        refreshLibraryMutation.mutate({
                          path: {
                            id: mediaSource.id,
                            libraryId: library.id,
                          },
                          query: {
                            forceScan: false,
                          },
                        })
                      }
                    >
                      {library.isLocked ? (
                        <Refresh
                          sx={{ animation: 'spin 2s linear infinite' }}
                        />
                      ) : (
                        <FindReplace />
                      )}
                    </IconButton>
                  </span>
                </Tooltip>
              )}
              <Tooltip
                placement="top"
                title={
                  library.mediaType === 'music_videos'
                    ? 'Music Video libraries are not yet supported'
                    : library.isLocked
                      ? 'Cannot disable libraries when they are locked'
                      : null
                }
              >
                <span>
                  <Switch
                    edge="end"
                    disabled={
                      library.isLocked || library.mediaType === 'music_videos'
                    }
                    checked={library.enabled}
                    onChange={(ev) =>
                      updateLibraryEnabled(library.id, ev.target.checked)
                    }
                  />
                </span>
              </Tooltip>
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={() => onClose()}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
