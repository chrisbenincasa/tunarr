import {
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import { PlexServerSettings } from 'dizquetv-types';
import { isUndefined, isEmpty } from 'lodash-es';
import { useState, useEffect } from 'react';
import { usePlexServerSettings } from '../../hooks/settingsHooks.ts';
import { usePlex } from '../../hooks/usePlex.ts';

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
            <ListItem>
              <ListItemText>{dir.title}</ListItemText>
            </ListItem>
          ))}
        </List>
      </DialogContent>
    </>
  );
}
