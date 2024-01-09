import { Box, Button, Paper, Typography } from '@mui/material';
import { ChannelProgrammingConfig } from '../../components/channel_config/ChannelProgrammingConfig.tsx';
import { usePreloadedData } from '../../hooks/preloadedDataHook.ts';
import { editProgrammingLoader } from './loaders.ts';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { WorkingProgram } from '../../store/channelEditor/store.ts';
import { apiClient } from '../../external/api.ts';
import useStore from '../../store/index.ts';
import z from 'zod';
import { WorkingProgramSchema } from 'dizquetv-types/schemas';

export default function ChannelProgrammingPage() {
  const { channel } = usePreloadedData(editProgrammingLoader);
  const newLineup = useStore((s) => s.channelEditor.programList);

  const updateLineupMutation = useMutation({
    mutationKey: ['channels', channel.number, 'lineup'],
    mutationFn: (newLineup: WorkingProgram[]) => {
      console.log(newLineup);
      z.array(WorkingProgramSchema).parse(newLineup);
      return apiClient.post('/api/v2/channels/:number/lineup', newLineup, {
        params: { number: channel.number },
      });
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
