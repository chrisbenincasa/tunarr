// TODO remove lint warning when we use this

import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Channel, UpdateChannelRequest } from '@tunarr/types';
import dayjs from 'dayjs';
import { maxBy } from 'lodash-es';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEffectOnce } from 'usehooks-ts';
import EditChannelControls from '../../components/channel_config/EditChannelControls.tsx';
import { apiClient } from '../../external/api.ts';
import { usePreloadedData } from '../../hooks/preloadedDataHook.ts';
import { setCurrentChannel } from '../../store/channelEditor/actions.ts';
import useStore from '../../store/index.ts';
import { newChannelLoader } from './loaders.ts';
import { v4 as uuidv4 } from 'uuid';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function defaultNewChannel(num: number): Channel {
  return {
    id: uuidv4(),
    name: `Channel ${num}`,
    number: num,
    startTime: dayjs().unix() * 1000,
    duration: 0,
    programs: [],
    icon: {
      duration: 0,
      path: '',
      position: 'bottom',
      width: 0,
    },
    guideMinimumDurationSeconds: 300,
    groupTitle: 'tv',
    stealth: false,
    disableFillerOverlay: false,
    offline: {
      mode: 'pic',
    },
  };
}

export default function NewChannelPage() {
  // Select channel numbers
  const channels = usePreloadedData(newChannelLoader);
  const channel = defaultNewChannel(
    (maxBy(channels, (c) => c.number)?.number ?? 0) + 1,
  );
  const workingChannel = useStore((s) => s.channelEditor.currentEntity);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffectOnce(() => {
    setCurrentChannel(channel, []);
  });

  const resetChannel = useCallback(() => {
    setCurrentChannel(
      defaultNewChannel((maxBy(channels, (c) => c.number)?.number ?? 0) + 1),
      [],
    );
  }, [channels]);

  const newChannelMutation = useMutation({
    mutationFn: (channel: UpdateChannelRequest) => {
      return apiClient.post('/api/v2/channels', channel);
    },
    mutationKey: ['channels'],
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['channels'],
        exact: true,
      });
      navigate('/channels');
    },
  });

  const saveNewChannel = () => {
    newChannelMutation.mutate(workingChannel!);
  };

  return (
    <div>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Channel {channel.number}
      </Typography>
      <EditChannelControls />
      <Stack spacing={2} direction="row" justifyContent="right" sx={{ mt: 2 }}>
        <Button onClick={() => resetChannel()} variant="outlined">
          Reset Options
        </Button>
        <Button
          disabled={newChannelMutation.isPending}
          onClick={() => saveNewChannel()}
          variant="contained"
        >
          Save
        </Button>
      </Stack>
    </div>
  );
}
