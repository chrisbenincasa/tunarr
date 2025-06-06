import type { UseMutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Channel, SaveableChannel } from '@tunarr/types';
import { ZodiosError } from '@tunarr/zodios-core';
import { z } from 'zod/v4';
import { useTunarrApi } from './useTunarrApi';

export const useUpdateChannel = (
  opts?: UseMutationOptions<Channel, Error, SaveableChannel>,
) => {
  const queryClient = useQueryClient();
  const apiClient = useTunarrApi();

  const updateChannel = useMutation({
    mutationKey: ['channels', 'update'],
    mutationFn: async (channelUpdates: SaveableChannel) => {
      return apiClient.updateChannel(channelUpdates, {
        params: { id: channelUpdates.id },
      });
    },
    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({
        exact: false,
        queryKey: ['channels'],
      });

      updateChannel.reset();

      if (opts?.onSuccess) {
        opts?.onSuccess(...args);
      }
    },
    onError: (error, vars, ctx) => {
      if (error instanceof ZodiosError) {
        console.error(error.message, error.data, error.cause);
        if (error.cause instanceof z.ZodError) {
          console.error(error.cause.message);
        }
        console.error(error.cause);
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
