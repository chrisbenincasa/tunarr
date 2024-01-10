import { Box, Button, Paper, Typography } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ZodiosError } from '@zodios/core';
import { ChannelProgram } from 'dizquetv-types';
import { Link } from 'react-router-dom';
import { ChannelProgrammingConfig } from '../../components/channel_config/ChannelProgrammingConfig.tsx';
import { apiClient } from '../../external/api.ts';
import { usePreloadedData } from '../../hooks/preloadedDataHook.ts';
import { setCurrentLineup } from '../../store/channelEditor/actions.ts';
import useStore from '../../store/index.ts';
import { editProgrammingLoader } from './loaders.ts';

export default function ChannelProgrammingPage() {
  const { channel } = usePreloadedData(editProgrammingLoader);
  const newLineup = useStore((s) => s.channelEditor.programList);
  const queryClient = useQueryClient();

  // TODO we need to update the channel start time too
  const updateLineupMutation = useMutation({
    mutationKey: ['channels', channel.number, 'lineup'],
    mutationFn: (newLineup: ChannelProgram[]) => {
      return apiClient.post('/api/v2/channels/:number/lineup', newLineup, {
        params: { number: channel.number },
      });
    },
    onSuccess: async (data) => {
      setCurrentLineup(data.programs);
      await queryClient.invalidateQueries({
        queryKey: ['channels', channel.number],
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
      .mutateAsync(newLineup)
      .then(console.log)
      .catch(console.error);
  };

  return (
    <div>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Channel {channel.number} Programming
      </Typography>
      <Paper sx={{ p: 2 }}>
        <ChannelProgrammingConfig />
      </Paper>
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
