import { Trans } from '@lingui/react/macro';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteApiMediaSourcesByIdMutation } from '../../../generated/@tanstack/react-query.gen.ts';

export function MediaSourceDeleteDialog({
  open,
  onClose,
  serverId,
}: PlexServerDeleteDialogProps) {
  const queryClient = useQueryClient();
  const deleteMediaSourceMutation = useMutation({
    ...deleteApiMediaSourcesByIdMutation(),
    onSuccess: () => {
      return queryClient.invalidateQueries({
        queryKey: ['settings', 'media-sources'],
      });
    },
  });

  const titleId = `delete-media-source-${serverId}-title`;
  const descId = `delete-media-source-${serverId}-description`;

  return (
    <Dialog open={open} aria-labelledby={titleId} aria-describedby={descId}>
      <DialogTitle id={titleId}><Trans>Delete Media Source?</Trans></DialogTitle>
      <DialogContent>
        <DialogContentText id={descId}>
          <Trans>Deleting a Plex server will remove all programming from your channels
          associated with this plex server. Missing programming will be replaced
          with Flex time. This action cannot be undone.</Trans>
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} autoFocus>
          <Trans>Cancel</Trans>
        </Button>
        <Button
          onClick={() =>
            deleteMediaSourceMutation.mutate({ path: { id: serverId } })
          }
          variant="contained"
        >
          <Trans>Delete</Trans>
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export type PlexServerDeleteDialogProps = {
  open: boolean;
  onClose: () => void;
  serverId: string;
};
