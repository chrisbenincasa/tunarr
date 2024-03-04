import DeleteIcon from '@mui/icons-material/Delete';
import { ListItemText, IconButton, Fab } from '@mui/material';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import { isPlexDirectory, isPlexShow, isPlexSeason } from '@tunarr/types/plex';
import { useCallback } from 'react';
import { removeSelectedMedia } from '../../store/programmingSelector/actions.ts';
import { SelectedMedia } from '../../store/programmingSelector/store.ts';
import useStore from '../../store/index.ts';

export default function SelectedProgrammingList() {
  const knownMedia = useStore((s) => s.knownMediaByServer);
  const selectedMedia = useStore((s) => s.selectedMedia);

  const removeSelectedItem = useCallback((selectedMedia: SelectedMedia) => {
    removeSelectedMedia(selectedMedia.server, [selectedMedia.guid]);
  }, []);

  const renderSelectedItems = () => {
    const items = selectedMedia.map((selected) => {
      const media = knownMedia[selected.server][selected.guid];
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
        <Fab
          variant="extended"
          sx={{
            position: 'fixed',
            bottom: '1em',
            width: '300px',
            margin: '0 auto',
            left: 0,
            right: 0,
          }}
        >
          {selectedMedia.length} Selected Programs
        </Fab>
      )}
    </>
  );
}
