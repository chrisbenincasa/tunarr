import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SaveChannelRequest } from '@tunarr/types';
import { ZodiosError } from '@zodios/core';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../external/api';

export const useUpdateChannel = (isNewChannel: boolean) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const updateChannel = useMutation({
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
      if (isNewChannel) {
        navigate('/channels');
      } else {
        updateChannel.reset();
      }
    },
    onError: (error) => {
      if (error instanceof ZodiosError) {
        console.error(error.data);
        console.error(error, error.cause);
      }
    },
  });

  return updateChannel;
};
