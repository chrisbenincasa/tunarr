import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTunarrApi } from '@/hooks/useTunarrApi.ts';

export function MediaSourceDeleteDialog({
  open,
  onClose,
  serverId,
}: PlexServerDeleteDialogProps) {
  const apiClient = useTunarrApi();
  const queryClient = useQueryClient();
  const deleteMediaSourceMutation = useMutation({
    mutationFn: (id: string) => {
      return apiClient.deleteMediaSource(null, { params: { id } });
    },
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
      <DialogTitle id={titleId}>Delete Media Source?</DialogTitle>
      <DialogContent>
        <DialogContentText id={descId}>
          Deleting a Plex server will remove all programming from your channels
          associated with this plex server. Missing programming will be replaced
          with Flex time. This action cannot be undone.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} autoFocus>
          Cancel
        </Button>
        <Button
          onClick={() => deleteMediaSourceMutation.mutate(serverId)}
          variant="contained"
        >
          Delete
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
