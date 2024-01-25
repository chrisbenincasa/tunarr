import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material';
import { PlexMedia } from '@tunarr/types/plex';
import { isEmpty, isUndefined } from 'lodash-es';
import React, { useEffect } from 'react';
import { usePlex } from '../../hooks/plexHooks.ts';
import { usePlexServerSettings } from '../../hooks/settingsHooks.ts';
import useStore from '../../store/index.ts';
import {
  addKnownMediaForServer,
  setProgrammingListingServer,
} from '../../store/programmingSelector/actions.ts';
import AddSelectedMediaButton from './AddSelectedMediaButton.tsx';
import ProgrammingSelector from './ProgrammingSelector.tsx';
import { addPlexMediaToCurrentChannel } from '../../store/channelEditor/actions.ts';

export interface PlexListItemProps<T extends PlexMedia> {
  item: T;
  style?: React.CSSProperties;
  index?: number;
  length: number;
  parent?: string;
}

export default function ProgrammingSelectorDialog(props: {
  open: boolean;
  onClose: () => void;
}) {
  const { data: plexServers } = usePlexServerSettings();
  const selectedServer = useStore((s) => s.currentServer);

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

  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="md" fullWidth>
      <DialogTitle>Add Programming</DialogTitle>
      <DialogContent>
        <ProgrammingSelector />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => props.onClose()}>Cancel</Button>
        <AddSelectedMediaButton
          onAdd={addPlexMediaToCurrentChannel}
          onSuccess={() => props.onClose()}
        />
      </DialogActions>
    </Dialog>
  );
}
