import { AddCircle, SvgIconComponent } from '@mui/icons-material';
import { Button } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { InsertPlexServerRequest } from '@tunarr/types/api';
import { checkNewPlexServers, plexLoginFlow } from '../../helpers/plexLogin.ts';
import { useTunarrApi } from '../../hooks/useTunarrApi.ts';
import { isEmpty } from 'lodash-es';
import { useSnackbar } from 'notistack';

type AddPlexServer = {
  title?: string;
  variant?: 'text' | 'contained' | 'outlined' | undefined;
  icon?: SvgIconComponent;
};

export default function AddPlexServer(props: AddPlexServer) {
  const apiClient = useTunarrApi();
  const { title = 'Add', variant = 'contained', ...restProps } = props;
  const queryClient = useQueryClient();
  const snackbar = useSnackbar();

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
        if (isEmpty(connections)) {
          snackbar.enqueueSnackbar({
            variant: 'error',
            message: (
              <>
                Unable to find any successful Plex connections.
                <br />
                Please check your browser console log for details.
              </>
            ),
          });
        }

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

  const IconComponent = props.icon ?? AddCircle;

  return (
    <Button
      color="inherit"
      onClick={() => addPlexServer()}
      variant={variant}
      startIcon={<IconComponent />}
      {...restProps}
    >
      {title}
    </Button>
  );
}
