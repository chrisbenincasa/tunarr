import {
  UseMutationOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { Channel, SaveChannelRequest } from '@tunarr/types';
import { ZodiosError } from '@zodios/core';
import { useTunarrApi } from './useTunarrApi';

export const useUpdateChannel = (
  isNewChannel: boolean,
  opts?: UseMutationOptions<Channel, Error, SaveChannelRequest>,
) => {
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
    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({
        exact: false,
        queryKey: ['channels'],
      });

      if (!isNewChannel) {
        updateChannel.reset();
      }

      if (opts?.onSuccess) {
        opts?.onSuccess(...args);
      }
    },
    onError: (error, vars, ctx) => {
      if (error instanceof ZodiosError) {
        console.error(error.data);
        console.error(error, error.cause, error.message);
      } else {
        console.error(error);
      }

      if (opts?.onError) {
        opts?.onError(error, vars, ctx);
      }
    },
  });

  return updateChannel;
};
