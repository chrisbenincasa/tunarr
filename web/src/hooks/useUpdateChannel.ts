import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SaveChannelRequest } from '@tunarr/types';
import { ZodiosError } from '@zodios/core';
import { useNavigate } from 'react-router-dom';
import { useTunarrApi } from './useTunarrApi';

export const useUpdateChannel = (isNewChannel: boolean) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const apiClient = useTunarrApi();

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
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        exact: false,
        queryKey: ['channels'],
      });
      if (isNewChannel) {
        navigate(`/channels/${data.id}/programming`);
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
