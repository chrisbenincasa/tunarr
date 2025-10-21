import { ChannelOptionsButton } from '@/components/channels/ChannelOptionsButton.tsx';
import {
  Box,
  LinearProgress,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import { Suspense } from 'react';
import Breadcrumbs from '../../components/Breadcrumbs.tsx';
import { ChannelNowPlayingCard } from '../../components/channels/ChannelNowPlayingCard.tsx';
import { ChannelPrograms } from '../../components/channels/ChannelPrograms.tsx';
import { ChannelSummaryQuickStats } from '../../components/channels/ChannelSummaryQuickStats.tsx';
import TunarrLogo from '../../components/TunarrLogo.tsx';
import { isNonEmptyString } from '../../helpers/util.ts';
import { useChannelAndProgramming } from '../../hooks/useChannelLineup.ts';
import { Route } from '../../routes/channels_/$channelId/index.tsx';

export const ChannelSummaryPage = () => {
  const { channelId } = Route.useParams();
  const {
    data: { channel },
  } = useChannelAndProgramming(channelId);

  const theme = useTheme();
  const smallViewport = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Stack spacing={2}>
      <Breadcrumbs />
      <Stack direction="row" alignItems="center" spacing={1}>
        <Box>
          {isNonEmptyString(channel.icon.path) ? (
            <Box component="img" width={[32, 132]} src={channel.icon.path} />
          ) : (
            <TunarrLogo style={{ width: smallViewport ? '32px' : '132px' }} />
          )}
        </Box>

        <Box sx={{ flex: 1 }}>
          <Typography variant="h4">{channel.name}</Typography>
          <Typography variant="subtitle1">Channel #{channel.number}</Typography>
        </Box>
      </Stack>
      <Stack direction="row" spacing={1} justifyContent="right">
        <ChannelOptionsButton
          channel={channel}
          hideItems={['duplicate', 'delete']}
        />
      </Stack>
      <Box sx={{ width: '100%' }}>
        <Suspense fallback={<LinearProgress />}>
          <ChannelNowPlayingCard channelId={channelId} />
        </Suspense>
      </Box>
      <ChannelSummaryQuickStats channelId={channelId} />
      <ChannelPrograms channelId={channelId} />
    </Stack>
  );
};
