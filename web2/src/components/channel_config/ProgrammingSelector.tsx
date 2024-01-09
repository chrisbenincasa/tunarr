import DeleteIcon from '@mui/icons-material/Delete';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import {
  PlexLibrarySection,
  PlexMedia,
  isPlexDirectory,
  isPlexSeason,
  isPlexShow,
} from 'dizquetv-types/plex';
import { flattenDeep, isEmpty, isUndefined, keys } from 'lodash-es';
import React, { useCallback, useEffect } from 'react';
import { sequentialPromises } from '../../helpers/util.ts';
import { enumeratePlexItem, usePlex } from '../../hooks/plexHooks.ts';
import { usePlexServerSettings } from '../../hooks/settingsHooks.ts';
import { addPlexMediaToCurrentChannel } from '../../store/channelEditor/actions.ts';
import useStore from '../../store/index.ts';
import {
  addKnownMediaForServer,
  removeSelectedMedia,
  setProgrammingListingServer,
} from '../../store/programmingSelector/actions.ts';
import { SelectedMedia } from '../../store/programmingSelector/store.ts';
import { PlexDirectoryListItem } from './PlexDirectoryListItem.tsx';

export interface PlexListItemProps<T extends PlexMedia> {
  item: T;
  style?: React.CSSProperties;
  index?: number;
  length: number;
  parent?: string;
}

export default function ProgrammingSelector(props: {
  open: boolean;
  onClose: () => void;
}) {
  const { data: plexServers } = usePlexServerSettings();
  const selectedServer = useStore((s) => s.currentServer);
  // const listingsByServer = useStore((s) => s.listingsByServer);
  const knownMedia = useStore((s) => s.knownMediaByServer);
  const selectedMedia = useStore((s) => s.selectedMedia);
  const hierarchyByServer = useStore((s) => s.contentHierarchyByServer);

  useEffect(() => {
    const server =
      !isUndefined(plexServers) && !isEmpty(plexServers)
        ? plexServers[0]
        : undefined;

    setProgrammingListingServer(server);
  }, [plexServers]);

  const { data: directoryChildren } = usePlex(
    selectedServer?.name ?? '',
    '/library/sections',
    !isUndefined(selectedServer),
  );

  useEffect(() => {
    if (directoryChildren) {
      addKnownMediaForServer(selectedServer!.name, [
        ...directoryChildren.Directory,
      ]);
    }
  }, [selectedServer, directoryChildren]);

  const addSelectedItems = () => {
    sequentialPromises(selectedMedia, (selected) => {
      const media = knownMedia[selected.server][selected.guid];
      return enumeratePlexItem(selected.server, media)();
    })
      .then(flattenDeep)
      .then(addPlexMediaToCurrentChannel)
      .then(() => {
        props.onClose();
      })
      .catch(console.error);
  };

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

  const renderListItems = () => {
    const directoryIds = keys(hierarchyByServer[selectedServer!.name]);
    const mediaForServer = knownMedia[selectedServer!.name] ?? {};

    return directoryIds
      .filter((id) => isPlexDirectory(mediaForServer[id]))
      .map((id) => (
        <PlexDirectoryListItem
          server={selectedServer!}
          key={id}
          item={mediaForServer[id] as PlexLibrarySection}
        />
      ));
  };

  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="md" fullWidth>
      <DialogTitle>Add Programming</DialogTitle>
      <DialogContent>
        <FormControl fullWidth size="small">
          {selectedServer && (
            <Select value={selectedServer?.name}>
              {plexServers?.map((server) => (
                <MenuItem key={server.name} value={server.name}>
                  {server.name}
                </MenuItem>
              ))}
            </Select>
          )}
        </FormControl>
        <List component="nav" sx={{ width: '100%' }}>
          {selectedServer && renderListItems()}
        </List>
        <Typography>Selected Items</Typography>
        <List>{selectedMedia.length > 0 && renderSelectedItems()}</List>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => props.onClose()}>Cancel</Button>
        <Button
          onClick={() => addSelectedItems()}
          disabled={selectedMedia.length === 0}
        >
          Add
        </Button>
      </DialogActions>
    </Dialog>
  );
}
