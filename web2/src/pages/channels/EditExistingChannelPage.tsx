import { Typography } from '@mui/material';
import EditChannelControls from '../../components/channel_config/EditChannelControls.tsx';
import { usePreloadedData } from '../../hooks/preloadedDataHook.ts';
import { setCurrentChannel } from '../../store/channelEditor/actions.ts';
import { editChannelLoader } from './loaders.ts';

export default function EditExistingChannelPage() {
  const channel = usePreloadedData(editChannelLoader);

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
