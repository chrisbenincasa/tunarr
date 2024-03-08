import { AddCircle } from '@mui/icons-material';
import { Button } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { InsertPlexServerRequest } from '@tunarr/types/api';
import { apiClient } from '../../external/api.ts';
import { checkNewPlexServers, plexLoginFlow } from '../../helpers/plexLogin.ts';

export default function AddPlexServer() {
  const queryClient = useQueryClient();

  const addPlexServerMutation = useMutation({
    mutationFn: (newServer: InsertPlexServerRequest) => {
      return apiClient.createPlexServer(newServer);
    },
    onSuccess: () => {
      return queryClient.invalidateQueries({
        queryKey: ['settings', 'plex-servers'],
      });
    },
  });

  const addPlexServer = () => {
    plexLoginFlow()
      .then(checkNewPlexServers)
      .then((connections) => {
        connections.forEach(({ server, connection }) =>
          addPlexServerMutation.mutate({
            name: server.name,
            uri: connection.uri,
            accessToken: server.accessToken,
          }),
        );
      })
      .catch(console.error);
  };

  return (
    <Button
      onClick={() => addPlexServer()}
      variant="contained"
      startIcon={<AddCircle />}
    >
      Add
    </Button>
  );
}
