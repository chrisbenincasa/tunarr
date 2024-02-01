import React from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Snackbar,
  Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ZodiosError } from '@zodios/core';
import { ChannelProgram } from '@tunarr/types';
import { isUndefined } from 'lodash-es';
import { Link } from 'react-router-dom';
import { ChannelProgrammingConfig } from '../../components/channel_config/ChannelProgrammingConfig.tsx';
import { apiClient } from '../../external/api.ts';
import { usePreloadedChannel } from '../../hooks/usePreloadedChannel.ts';
import { setCurrentLineup } from '../../store/channelEditor/actions.ts';
import { useTheme } from '@mui/material/styles';

type MutateArgs = { channelId: string; newLineup: ChannelProgram[] };

type SnackBar = {
  display: boolean;
  message: string;
  color: string;
};

export default function ChannelProgrammingPage() {
  const { currentEntity: channel, programList: newLineup } =
    usePreloadedChannel();

  const queryClient = useQueryClient();
  const theme = useTheme();

  const [snackStatus, setSnackStatus] = React.useState<SnackBar>({
    display: false,
    color: '',
    message: '',
  });

  // TODO we need to update the channel start time too
  const updateLineupMutation = useMutation({
    mutationKey: ['updateChannelProgramming'],
    mutationFn: ({ channelId, newLineup }: MutateArgs) => {
      return apiClient.post('/api/v2/channels/:id/programming', newLineup, {
        params: { id: channelId },
      });
    },
    onSuccess: async (data, { channelId: channelNumber }) => {
      setCurrentLineup(data.programs, /*dirty=*/ false);
      setSnackStatus({
        display: true,
        message: 'Programs Saved!',
        color: theme.palette.success.main,
      });
      await queryClient.invalidateQueries({
        queryKey: ['channels', channelNumber],
      });
    },
    onError: (error) => {
      setSnackStatus({
        display: true,
        message: error.message,
        color: theme.palette.error.main,
      });
      if (error instanceof ZodiosError) {
        console.error(error.data);
        console.error(error, error.cause);
      }
    },
  });

  const handleSnackClose = () => {
    setSnackStatus({ display: false, message: '', color: '' });
  };

  const onSave = () => {
    updateLineupMutation
      .mutateAsync({ channelId: channel!.id, newLineup })
      .then(console.log)
      .catch(console.error);
  };

  return isUndefined(channel) ? (
    <div>
      <CircularProgress />
    </div>
  ) : (
    <div>
      <Snackbar
        open={snackStatus.display}
        autoHideDuration={6000}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        onClose={handleSnackClose}
        message={snackStatus.message}
        sx={{ backgroundColor: snackStatus.color }}
      />
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
