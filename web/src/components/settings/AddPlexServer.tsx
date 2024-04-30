import { AddCircle } from '@mui/icons-material';
import { Button } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { InsertPlexServerRequest } from '@tunarr/types/api';
import { checkNewPlexServers, plexLoginFlow } from '../../helpers/plexLogin.ts';
import { useTunarrApi } from '../../hooks/useTunarrApi.ts';

type AddPlexServer = {
  title?: string;
  variant?: 'text' | 'contained' | 'outlined' | undefined;
};

export default function AddPlexServer(props: AddPlexServer) {
  const apiClient = useTunarrApi();
  const { title = 'Add', variant = 'contained', ...restProps } = props;
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
      .then(checkNewPlexServers(apiClient))
      .then((connections) => {
        connections.forEach(({ server, connection }) =>
          addPlexServerMutation.mutate({
            name: server.name,
            uri: connection.uri,
            accessToken: server.accessToken,
            clientIdentifier: server.clientIdentifier,
          }),
        );
      })
      .catch(console.error);
  };

  return (
    <Button
      color="inherit"
      onClick={() => addPlexServer()}
      variant={variant}
      startIcon={<AddCircle />}
      {...restProps}
    >
      {title}
    </Button>
  );
}
