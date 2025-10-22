import { ChannelOptionsButton } from '@/components/channels/ChannelOptionsButton.tsx';
import { useChannelSuspense } from '@/hooks/useChannels.ts';
import { Route } from '@/routes/channels_/$channelId/watch.tsx';
import { Stack } from '@mui/material';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import Breadcrumbs from '../../components/Breadcrumbs.tsx';
import Video from '../../components/Video.tsx';
import { TvGuide } from '../../components/guide/TvGuide.tsx';
import { roundCurrentTime } from '../../helpers/util.ts';

export default function ChannelWatchPage() {
  const { channelId } = Route.useParams();
  const { data: channel } = useChannelSuspense(channelId);
  // Unclear whether these need to be state values right now
  // TODO: We probably want common hooks pulled from the GuidePage
  // that install the useInterval, updaters to start/end time, etc.
  const [start] = useState(roundCurrentTime(15));
  const [end] = useState(start.add(2, 'hours'));

  return (
    channel && (
      <div>
        <Breadcrumbs />
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <Typography variant="h4" sx={{ mb: 2, width: '100%' }}>
            "{channel.name}" Live
          </Typography>
          <ChannelOptionsButton
            channel={channel}
            hideItems={['duplicate', 'delete', 'watch']}
          />
        </Stack>
        <Video channelId={channel.id} />
        <TvGuide channelId={channel.id} start={start} end={end} />
      </div>
    )
  );
}
