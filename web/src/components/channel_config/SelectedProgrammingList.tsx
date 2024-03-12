import { AddCircle, Delete } from '@mui/icons-material';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  Box,
  Button,
  IconButton,
  ListItemText,
  Tooltip,
  Typography,
} from '@mui/material';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import { isPlexDirectory, isPlexSeason, isPlexShow } from '@tunarr/types/plex';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { addPlexMediaToCurrentChannel } from '../../store/channelEditor/actions.ts';
import useStore from '../../store/index.ts';
import {
  clearSelectedMedia,
  removeSelectedMedia,
} from '../../store/programmingSelector/actions.ts';
import { SelectedMedia } from '../../store/programmingSelector/store.ts';
import AddSelectedMediaButton from './AddSelectedMediaButton.tsx';

export default function SelectedProgrammingList() {
  const knownMedia = useStore((s) => s.knownMediaByServer);
  const selectedMedia = useStore((s) => s.selectedMedia);
  const darkMode = useStore((state) => state.theme.darkMode);
  const navigate = useNavigate();

  const removeSelectedItem = useCallback((selectedMedia: SelectedMedia) => {
    removeSelectedMedia(selectedMedia.server, [selectedMedia.guid]);
  }, []);

  const removeAllItems = useCallback(() => {
    clearSelectedMedia();
  }, []);

  const renderSelectedItems = () => {
    const items = selectedMedia.map((selected) => {
      const media = knownMedia[selected.server][selected.guid];
      console.log(media);

      let title: string = media.title;
      if (isPlexDirectory(media)) {
        title = `Library - ${media.title}`;
      } else if (isPlexShow(media)) {
        title = `${media.title} (${media.childCount} season(s), ${media.leafCount} total episodes)`;
      } else if (isPlexSeason(media)) {
        title = `${media.parentTitle} - ${media.title} (${media.leafCount} episodes)`;
      }

      return (
        <ListItem key={selected.guid} dense>
          <ListItemText primary={title} />
          <ListItemIcon>
            <IconButton onClick={() => removeSelectedItem(selected)}>
              <DeleteIcon color="error" />
            </IconButton>
          </ListItemIcon>
        </ListItem>
      );
    });
    return <List>{items}</List>;
  };

  return (
    <>
      <List>{selectedMedia.length > 0 && renderSelectedItems()}</List>
      {selectedMedia.length > 0 && (
        <Box
          sx={{
            borderRadius: '10px',
            backgroundColor: 'primary.main',
            color: '#fff',
            position: 'fixed',
            bottom: '1em',
            width: '500px',
            margin: '1em auto',
            left: 0,
            right: 0,
            display: 'flex',
            padding: '5px 0',
          }}
        >
          <Typography
            sx={{
              display: 'flex',
              alignItems: 'center',
              marginLeft: '1em',
              flexGrow: '1',
            }}
          >
            {selectedMedia.length} Selected Programs{' '}
          </Typography>

          <Tooltip title="Unselect all programs">
            <Button
              startIcon={<Delete />}
              sx={{
                color: darkMode ? '#fff' : '#fff',
                border: '1px solid white',
                borderRadius: '10px',
                marginRight: '8px',
              }}
              onClick={() => removeAllItems()}
            >
              Unselect All
            </Button>
          </Tooltip>

          <AddSelectedMediaButton
            onAdd={addPlexMediaToCurrentChannel}
            startIcon={<AddCircle />}
            onSuccess={() => navigate('..', { relative: 'path' })}
            sx={{
              color: '#fff',
              border: '1px solid white',
              borderRadius: '10px',
              marginRight: '8px',
            }}
          />
        </Box>
      )}
    </>
  );
}
