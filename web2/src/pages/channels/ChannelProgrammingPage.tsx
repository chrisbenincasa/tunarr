import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ZodiosError } from '@zodios/core';
import { ChannelProgram } from '@tunarr/types';
import { isUndefined } from 'lodash-es';
import { Link } from 'react-router-dom';
import { ChannelProgrammingConfig } from '../../components/channel_config/ChannelProgrammingConfig.tsx';
import { apiClient } from '../../external/api.ts';
import { usePreloadedChannel } from '../../hooks/usePreloadedChannel.ts';
import { setCurrentLineup } from '../../store/channelEditor/actions.ts';

type MutateArgs = { channelNumber: number; newLineup: ChannelProgram[] };

export default function ChannelProgrammingPage() {
  const { currentEntity: channel, programList: newLineup } =
    usePreloadedChannel();
  const queryClient = useQueryClient();

  // TODO we need to update the channel start time too
  const updateLineupMutation = useMutation({
    mutationKey: ['updateChannelProgramming'],
    mutationFn: ({ channelNumber, newLineup }: MutateArgs) => {
      return apiClient.post('/api/v2/channels/:number/programming', newLineup, {
        params: { number: channelNumber },
      });
    },
    onSuccess: async (data, { channelNumber }) => {
      setCurrentLineup(data.programs, /*dirty=*/ false);
      await queryClient.invalidateQueries({
        queryKey: ['channels', channelNumber],
      });
    },
    onError: (error) => {
      if (error instanceof ZodiosError) {
        console.error(error.data);
        console.error(error, error.cause);
      }
    },
  });

  const onSave = () => {
    updateLineupMutation
      .mutateAsync({ channelNumber: channel.number, newLineup })
      .then(console.log)
      .catch(console.error);
  };

  return isUndefined(channel) ? (
    <div>
      <CircularProgress />
    </div>
  ) : (
    <div>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Channel {channel.number} Programming
      </Typography>
      <ChannelProgrammingConfig />
      <Box sx={{ display: 'flex', justifyContent: 'end', pt: 1, columnGap: 1 }}>
        <Button variant="contained" to="/channels" component={Link}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => onSave()}>
          Save
        </Button>
      </Box>
    </div>
  );
}
