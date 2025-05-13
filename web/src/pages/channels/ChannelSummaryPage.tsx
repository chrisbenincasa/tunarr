import { AddToQueue, Settings } from '@mui/icons-material';
import {
  Box,
  IconButton,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { Link } from '@tanstack/react-router';
import { Suspense } from 'react';
import Breadcrumbs from '../../components/Breadcrumbs.tsx';
import { ChannelNowPlayingCard } from '../../components/channels/ChannelNowPlayingCard.tsx';
import { ChannelPrograms } from '../../components/channels/ChannelPrograms.tsx';
import { ChannelSummaryQuickStats } from '../../components/channels/ChannelSummaryQuickStats.tsx';
import TunarrLogo from '../../components/TunarrLogo.tsx';
import { isNonEmptyString } from '../../helpers/util.ts';
import { useChannelAndProgramming } from '../../hooks/useChannelLineup.ts';
import { Route } from '../../routes/channels/$channelId.tsx';

export const ChannelSummaryPage = () => {
  const { channelId } = Route.useParams();
  const {
    data: { channel },
  } = useChannelAndProgramming(channelId);

  return (
    <Stack spacing={2}>
      <Breadcrumbs />
      <Stack direction="row" alignItems="center" spacing={1}>
        <Box>
          {isNonEmptyString(channel.icon.path) ? (
            <Box component="img" src={channel.icon.path} />
          ) : (
            <TunarrLogo style={{ width: '132px' }} />
          )}
        </Box>

        <Box sx={{ flex: 1 }}>
          <Typography variant="h3">{channel.name}</Typography>
          <Typography variant="subtitle1">Channel #{channel.number}</Typography>
        </Box>

        <Tooltip title="Edit" placement="top">
          <IconButton component={Link} from={Route.fullPath} to="./edit">
            <Settings />
          </IconButton>
        </Tooltip>
        <Tooltip title="Add Programming" placement="top">
          <IconButton component={Link} from={Route.fullPath} to="./programming">
            <AddToQueue />
          </IconButton>
        </Tooltip>
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
