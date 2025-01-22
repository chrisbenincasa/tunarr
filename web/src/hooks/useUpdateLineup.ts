import { resetCurrentLineup } from '@/store/channelEditor/actions';
import type { UseMutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CondensedChannelProgramming } from '@tunarr/types';
import type { UpdateChannelProgrammingRequest } from '@tunarr/types/api';
import { ZodiosError } from '@zodios/core';
import { useTunarrApi } from './useTunarrApi';

type MutateArgs = {
  channelId: string;
  lineupRequest: UpdateChannelProgrammingRequest;
};

export const useUpdateLineup = (
  opts?: UseMutationOptions<CondensedChannelProgramming, Error, MutateArgs>,
) => {
  const apiClient = useTunarrApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ channelId, lineupRequest }: MutateArgs) => {
      return apiClient.updateChannelProgramming(lineupRequest, {
        params: { id: channelId },
      });
    },
    onSuccess: async (...args) => {
      const [response, { channelId }] = args;

      resetCurrentLineup(response);

      await queryClient.invalidateQueries({
        queryKey: ['channels', channelId],
        exact: false,
      });

      if (opts?.onSuccess) {
        await opts.onSuccess(...args);
      }
    },
    onError: async (...args) => {
      const error = args[0];
      if (error instanceof ZodiosError) {
        console.error(error.message, error.data, error.cause);
      }

      if (opts?.onError) {
        await opts.onError(...args);
      }
    },
    onSettled: async (...args) => {
      if (opts?.onSettled) {
        await opts.onSettled(...args);
      }
    },
  });
};
