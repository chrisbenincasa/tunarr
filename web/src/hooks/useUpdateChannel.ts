import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SaveChannelRequest } from '@tunarr/types';
import { ZodiosError } from '@zodios/core';
import { useTunarrApi } from './useTunarrApi';

export const useUpdateChannel = (isNewChannel: boolean) => {
  const queryClient = useQueryClient();
  const apiClient = useTunarrApi();

  const updateChannel = useMutation({
    mutationKey: ['channels', isNewChannel ? 'create' : 'update'],
    mutationFn: async (channelUpdates: SaveChannelRequest) => {
      if (isNewChannel) {
        return apiClient.createChannel(channelUpdates);
      } else {
        return apiClient.updateChannel(channelUpdates, {
          params: { id: channelUpdates.id },
        });
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        exact: false,
        queryKey: ['channels'],
      });
      if (!isNewChannel) {
        updateChannel.reset();
      }
    },
    onError: (error) => {
      if (error instanceof ZodiosError) {
        console.error(error.data);
        console.error(error, error.cause, error.message);
      } else {
        console.error(error);
      }
    },
  });

  return updateChannel;
};
