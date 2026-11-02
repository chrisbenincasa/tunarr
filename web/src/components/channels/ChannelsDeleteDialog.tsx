import { Plural, Trans } from '@lingui/react/macro';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import type { Channel } from '@tunarr/types';

type Props = {
  // Null keeps the dialog closed.
  channels: Pick<Channel, 'id' | 'name'>[] | null;
  onConfirm: () => void;
  onClose: () => void;
};

const NamesShown = 5;

export const ChannelsDeleteDialog = ({
  channels,
  onConfirm,
  onClose,
}: Props) => {
  const count = channels?.length ?? 0;
  const shown = channels?.slice(0, NamesShown) ?? [];
  const more = count - shown.length;

  return (
    <Dialog
      open={channels !== null}
      onClose={onClose}
      aria-labelledby="delete-channels-title"
      aria-describedby="delete-channels-description"
    >
      <DialogTitle id="delete-channels-title">
        <Plural
          value={count}
          one="Delete # channel?"
          other="Delete # channels?"
        />
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="delete-channels-description">
          <Trans>
            Deleting a channel removes all of its programming. This cannot be
            undone.
          </Trans>
        </DialogContentText>
        <ul>
          {shown.map((channel) => (
            <li key={channel.id}>{channel.name}</li>
          ))}
          {more > 0 && (
            <li>
              <Plural value={more} one="and # more" other="and # more" />
            </li>
          )}
        </ul>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} autoFocus>
          <Trans>Cancel</Trans>
        </Button>
        <Button onClick={onConfirm} variant="contained" color="error">
          <Trans>Delete</Trans>
        </Button>
      </DialogActions>
    </Dialog>
  );
};
