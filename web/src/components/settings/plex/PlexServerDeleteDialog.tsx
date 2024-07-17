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

export function PlexServerDeleteDialog({
  open,
  onClose,
  serverId,
}: PlexServerDeleteDialogProps) {
  const apiClient = useTunarrApi();
  const queryClient = useQueryClient();
  const removePlexServerMutation = useMutation({
    mutationFn: (id: string) => {
      return apiClient.deletePlexServer(null, { params: { id } });
    },
    onSuccess: () => {
      return queryClient.invalidateQueries({
        queryKey: ['settings', 'plex-servers'],
      });
    },
  });

  const titleId = `delete-plex-server-${serverId}-title`;
  const descId = `delete-plex-server-${serverId}-description`;

  return (
    <Dialog open={open} aria-labelledby={titleId} aria-describedby={descId}>
      <DialogTitle id={titleId}>Delete Plex Server?</DialogTitle>
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
          onClick={() => removePlexServerMutation.mutate(serverId)}
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
