// TODO remove lint warning when we use this

import Typography from '@mui/material/Typography';
import dayjs from 'dayjs';
import { Channel } from 'dizquetv-types';
import EditChannelControls from './EditChannelPage.tsx';
import { setCurrentChannel } from '../../store/channelEditor/actions.ts';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function defaultNewChannel(num: number): Channel {
  return {
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
  const channel = defaultNewChannel(1000);

  setCurrentChannel(channel, []);

  return (
    <div>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Channel {channel.number}
      </Typography>
      <EditChannelControls />
    </div>
  );
}
