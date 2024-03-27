import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UpdateChannelProgrammingRequest } from '@tunarr/types/api';
import { ZodiosError } from '@zodios/core';
import { apiClient } from '../external/api';

type MutateArgs = {
  channelId: string;
  lineupRequest: UpdateChannelProgrammingRequest;
};

export const useUpdateLineup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ channelId, lineupRequest }: MutateArgs) => {
      return apiClient.post('/api/channels/:id/programming', lineupRequest, {
        params: { id: channelId },
      });
    },
    onSuccess: async (_, { channelId }) => {
      await queryClient.invalidateQueries({
        queryKey: ['channels', channelId],
        exact: false,
      });
    },
    onError: (error) => {
      if (error instanceof ZodiosError) {
        console.error(error.message, error.data, error.cause);
      }
    },
  });
};
