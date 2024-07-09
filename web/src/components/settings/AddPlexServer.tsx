import { AddCircle, SvgIconComponent } from '@mui/icons-material';
import { Button } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { InsertMediaSourceRequest } from '@tunarr/types/api';
import { isEmpty } from 'lodash-es';
import { useSnackbar } from 'notistack';
import { checkNewPlexServers, plexLoginFlow } from '../../helpers/plexLogin.ts';
import { useTunarrApi } from '../../hooks/useTunarrApi.ts';

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
    mutationFn: (newServer: InsertMediaSourceRequest) => {
      return apiClient.createMediaSource(newServer);
    },
    onSuccess: () => {
      return queryClient.invalidateQueries({
        queryKey: ['settings', 'media-sources'],
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
            type: 'plex',
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
