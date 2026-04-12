import { checkNewPlexServers, plexLoginFlow } from '@/helpers/plexLogin.ts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isNonEmptyString } from '@tunarr/shared/util';
import { isEmpty } from 'lodash-es';
import { useSnackbar } from 'notistack';
import { useCallback } from 'react';
import {
  getMediaSourcesQueryKey,
  createMediaSourceMutation,
} from '../../generated/@tanstack/react-query.gen.ts';

export const usePlexLogin = () => {
  const queryClient = useQueryClient();
  const snackbar = useSnackbar();

  const addPlexServerMutation = useMutation({
    ...createMediaSourceMutation(),
    onSuccess: () => {
      return queryClient.invalidateQueries({
        queryKey: getMediaSourcesQueryKey(),
        exact: false,
      });
    },
  });

  return useCallback(() => {
    plexLoginFlow()
      .then(checkNewPlexServers)
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

        connections.forEach(({ server, connection }) => {
          if (isNonEmptyString(server.accessToken)) {
            addPlexServerMutation.mutate({
              body: {
                name: server.name,
                uri: connection.uri,
                accessToken: server.accessToken,
                clientIdentifier: server.clientIdentifier,
                // These will be backfilled later, they require use of a different API
                userId: null,
                username: null,
                type: 'plex',
                pathReplacements: [],
              },
            });
          }
        });
      })
      .catch(console.error);
  }, [addPlexServerMutation, snackbar]);
};
