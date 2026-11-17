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

type DeletableChannel = Pick<Channel, 'id' | 'name'>;

type Props = {
  // Null keeps the dialog closed.
  channels: DeletableChannel[] | null;
  onConfirm: () => void;
  onClose: () => void;
};

type ContentProps = Omit<Props, 'channels'> & {
  channels: DeletableChannel[];
};

const NamesShown = 5;

const ChannelsDeleteDialogContent = ({
  channels,
  onConfirm,
  onClose,
}: ContentProps) => {
  const shown = channels.slice(0, NamesShown);
  const more = channels.length - shown.length;

  return (
    <>
      <DialogTitle id="delete-channels-title">
        <Plural
          value={channels.length}
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
    </>
  );
};

export const ChannelsDeleteDialog = ({
  channels,
  onConfirm,
  onClose,
}: Props) => {
  return (
    <Dialog
      open={channels !== null}
      onClose={onClose}
      aria-labelledby="delete-channels-title"
      aria-describedby="delete-channels-description"
    >
      {channels && (
        <ChannelsDeleteDialogContent
          channels={channels}
          onConfirm={onConfirm}
          onClose={onClose}
        />
      )}
    </Dialog>
  );
};
