import type { UseMutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Channel, CreateChannelRequest } from '@tunarr/types';
import { ZodiosError } from '@tunarr/zodios-core';
import { z } from 'zod/v4';
import { useTunarrApi } from './useTunarrApi.ts';

export const useCreateChannel = (
  opts?: UseMutationOptions<Channel, Error, CreateChannelRequest>,
) => {
  const queryClient = useQueryClient();
  const apiClient = useTunarrApi();

  return useMutation({
    mutationKey: ['channels', 'create'],
    mutationFn: async (createReq: CreateChannelRequest) => {
      return apiClient.createChannel(createReq);
    },
    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({
        exact: false,
        queryKey: ['channels'],
      });

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
};
