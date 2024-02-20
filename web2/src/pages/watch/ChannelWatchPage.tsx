import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';
import Video from '../../components/Video.tsx';
import { usePreloadedChannel } from '../../hooks/usePreloadedChannel.ts';

export default function ChannelWatchPage() {
  const channel = usePreloadedChannel();

  return (
    channel && (
      <div>
        <Breadcrumbs
          sx={{ mb: 2 }}
          separator="›"
          aria-label="channel-breadcrumb"
        >
          <Link
            underline="hover"
            color="inherit"
            component={RouterLink}
            to="/channels"
          >
            Channels
          </Link>
          <Box>Manage Programming</Box>
        </Breadcrumbs>
        <Typography variant="h4" sx={{ mb: 2 }}>
          Channel {channel.number} Live
        </Typography>
        <Video channelNumber={channel.number} />
      </div>
    )
  );
}
