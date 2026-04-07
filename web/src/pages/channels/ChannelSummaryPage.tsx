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
      <Stack direction="row" alignItems="flex-start" spacing={1}>
        <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
          <Box>
            {isNonEmptyString(channel.icon.path) ? (
              <Box component="img" width={[48, 132]} src={channel.icon.path} />
            ) : (
              <TunarrLogo style={{ width: smallViewport ? '48px' : '132px' }} />
            )}
          </Box>
          <Typography variant={smallViewport ? 'h5' : 'h4'} noWrap>
            {channel.name}
          </Typography>
          <Typography variant="subtitle1">Channel #{channel.number}</Typography>
        </Stack>

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
