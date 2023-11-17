import { ExpandLess, ExpandMore } from '@mui/icons-material';
import {
  Collapse,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
} from '@mui/material';
import { PlexServerSettings } from 'dizquetv-types';
import { PlexLibrarySection } from 'dizquetv-types/plex';
import { isEmpty, isUndefined } from 'lodash-es';
import { useEffect, useState } from 'react';
import { usePlexServerSettings } from '../../hooks/settingsHooks.ts';
import { usePlex } from '../../hooks/usePlex.ts';

function PlexDirectoryListItem(props: { item: PlexLibrarySection }) {
  const [open, setOpen] = useState(false);

  const handleClick = () => {
    setOpen(!open);
  };

  return (
    <>
      <ListItemButton onClick={handleClick}>
        <ListItemText primary={props.item.title} />
        {open ? <ExpandLess /> : <ExpandMore />}
      </ListItemButton>
      <Collapse in={open} timeout="auto" unmountOnExit></Collapse>
    </>
  );
}

export default function ProgrammingSelector() {
  const { data: plexServers } = usePlexServerSettings();

  const [selectedServer, setSelectedServer] = useState<
    PlexServerSettings | undefined
  >(undefined);

  useEffect(() => {
    const server =
      !isUndefined(plexServers) && !isEmpty(plexServers)
        ? plexServers[0]
        : undefined;

    setSelectedServer(server);
  }, [plexServers]);

  const { data: plexResponse, isPending } = usePlex(
    selectedServer?.name ?? '',
    '/library/sections',
    !isUndefined(selectedServer),
  );

  console.log(plexServers, selectedServer, plexResponse, isPending);

  return (
    <>
      <DialogTitle>Title</DialogTitle>
      <DialogContent>
        <List>
          {plexResponse?.Directory?.map((dir) => (
            <ListItem disablePadding>
              <PlexDirectoryListItem key={dir.uuid} item={dir} />
            </ListItem>
          ))}
        </List>
      </DialogContent>
    </>
  );
}
