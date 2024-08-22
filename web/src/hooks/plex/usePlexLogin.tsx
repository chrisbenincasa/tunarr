import { plexLoginFlow, checkNewPlexServers } from '@/helpers/plexLogin.ts';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { InsertMediaSourceRequest } from '@tunarr/types/api';
import { isEmpty } from 'lodash-es';
import { useSnackbar } from 'notistack';
import { useTunarrApi } from '@/hooks/useTunarrApi.ts';
import { useCallback } from 'react';

export const usePlexLogin = () => {
  const apiClient = useTunarrApi();
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

  return useCallback(() => {
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
  }, [addPlexServerMutation, apiClient, snackbar]);
};
