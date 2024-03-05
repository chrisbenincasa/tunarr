import Typography from '@mui/material/Typography';
import Breadcrumbs from '../../components/Breadcrumbs.tsx';
import Video from '../../components/Video.tsx';
import { usePreloadedChannel } from '../../hooks/usePreloadedChannel.ts';

export default function ChannelWatchPage() {
  const channel = usePreloadedChannel();

  return (
    channel && (
      <div>
        <Breadcrumbs />
        <Typography variant="h4" sx={{ mb: 2 }}>
          Channel {channel.number} Live
        </Typography>
        <Video channelNumber={channel.number} />
      </div>
    )
  );
}
