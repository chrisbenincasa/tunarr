import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Channel } from '@tunarr/types';
import type { SyntheticEvent } from 'react';
import {
  deleteApiChannelsByIdMutation,
  getChannelsQueryKey,
} from '../../generated/@tanstack/react-query.gen.ts';

type BaseProps = {
  onClose: (e: SyntheticEvent) => void;
};

type IsOpenProps = {
  open: true;
  channel: Channel;
};

type IsClosedProps = {
  open: false;
  channel: Channel | undefined;
};

type Props = BaseProps & (IsOpenProps | IsClosedProps);

export const ChannelDeleteDialog = ({ open, onClose, channel }: Props) => {
  const queryClient = useQueryClient();

  const removeChannelMutation = useMutation({
    ...deleteApiChannelsByIdMutation(),
    onSuccess: () => {
      return queryClient.invalidateQueries({
        queryKey: getChannelsQueryKey(),
      });
    },
  });

  const removeChannel = (e: SyntheticEvent, id: string) => {
    e.stopPropagation();
    removeChannelMutation.mutate({ path: { id } });
    onClose(e);
  };

  const handleClose = (e: SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClose(e);
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      aria-labelledby="delete-channel-title"
      aria-describedby="delete-channel-description"
    >
      {open && (
        <>
          <DialogTitle id="delete-channel-title">
            Delete Channel "{channel.name}"?
          </DialogTitle>
          <DialogContent>
            <DialogContentText id="delete-channel-description">
              Deleting a Channel will remove all programming from the channel.
              This action cannot be undone.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose} autoFocus>
              Cancel
            </Button>
            <Button
              onClick={(e) => removeChannel(e, channel.id)}
              variant="contained"
            >
              Delete
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
};
