import Typography from '@mui/material/Typography';
import { useState } from 'react';
import Breadcrumbs from '../../components/Breadcrumbs.tsx';
import Video from '../../components/Video.tsx';
import { TvGuide } from '../../components/guide/TvGuide.tsx';
import { roundCurrentTime } from '../../helpers/util.ts';
import { usePreloadedChannel } from '../../hooks/usePreloadedChannel.ts';

export default function ChannelWatchPage() {
  const channelData = usePreloadedChannel();
  const channel = channelData.data;
  // Unclear whether these need to be state values right now
  // TODO: We probably want common hooks pulled from the GuidePage
  // that install the useInterval, updaters to start/end time, etc.
  const [start] = useState(roundCurrentTime(15));
  const [end] = useState(start.add(2, 'hours'));

  return (
    channel && (
      <div>
        <Breadcrumbs />
        <Typography variant="h4" sx={{ mb: 2 }}>
          "{channel.name}" Live
        </Typography>
        <Video channelId={channel.id} />
        <TvGuide channelId={channel.id} start={start} end={end} />
      </div>
    )
  );
}
