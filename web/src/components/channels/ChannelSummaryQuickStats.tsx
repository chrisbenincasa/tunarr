import { Launch } from '@mui/icons-material';
import { Box, Grid, Paper, Stack, Typography } from '@mui/material';
import { seq } from '@tunarr/shared/util';
import type { ChannelStreamMode } from '@tunarr/types';
import * as globalDayjs from 'dayjs';
import { find, round, uniq } from 'lodash-es';
import { useMemo } from 'react';
import { match } from 'ts-pattern';
import { pluralizeWithCount } from '../../helpers/util.ts';
import { useTranscodeConfigs } from '../../hooks/settingsHooks.ts';
import { useChannelAndProgramming } from '../../hooks/useChannelLineup.ts';
import { RouterLink } from '../base/RouterLink.tsx';

const ChannelStreamModeToPrettyString: Record<ChannelStreamMode, string> = {
  hls: 'HLS',
  hls_direct: 'HLS Direct',
  hls_slower: 'HLS (alt)',
  mpegts: 'MPEG-TS',
};

type Props = {
  channelId: string;
};

export const ChannelSummaryQuickStats = ({ channelId }: Props) => {
  const {
    data: { channel, lineup },
  } = useChannelAndProgramming(channelId);
  const { data: transcodeConfigs } = useTranscodeConfigs();

  const uniqPrograms = useMemo(
    () =>
      uniq(
        seq.collect(lineup.lineup, (p) =>
          match(p)
            .with({ type: 'content' }, (p) => p.id)
            .with({ type: 'custom' }, (p) => p.program?.id)
            .otherwise(() => null),
        ),
      ).length,
    [lineup.lineup],
  );
  const transcodeConfig = useMemo(
    () => find(transcodeConfigs, { id: channel.transcodeConfigId }),
    [channel.transcodeConfigId, transcodeConfigs],
  );

  const channelDurationString = useMemo(() => {
    const dur = globalDayjs.duration(channel.duration);
    if (+dur <= 0) {
      return '0 mins';
    }

    const days = dur.asDays();
    if (days >= 1) {
      return pluralizeWithCount('days', round(days, 2));
    }

    const hours = dur.asHours();
    if (hours >= 1) {
      return pluralizeWithCount('hour', round(hours));
    }

    return pluralizeWithCount('minute', round(dur.asMinutes(), 2));
  }, [channel.duration]);

  return (
    <Grid
      container
      direction={['column', 'row']}
      rowSpacing={2}
      component={Paper}
      sx={{
        '> :not(:last-of-type)': {
          borderRightColor: [undefined, 'divider'],
          borderRightWidth: [undefined, 1],
          borderRightStyle: [undefined, 'solid'],
        },
      }}
    >
      <Grid size={{ xs: 12, md: 4 }} sx={{ p: 1 }}>
        <Stack direction="row">
          <div>
            <Typography variant="overline">Total Runtime</Typography>
            <Typography variant="h5">{channelDurationString}</Typography>
          </div>
          <Box></Box>
        </Stack>
      </Grid>
      <Grid size={{ xs: 12, md: 4 }} sx={{ p: 1 }}>
        <Stack direction="row">
          <div>
            <Typography variant="overline">Programs</Typography>
            <Typography variant="h5">{uniqPrograms}</Typography>
          </div>
        </Stack>
      </Grid>
      <Grid size={{ xs: 12, md: 2 }} sx={{ p: 1 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="overline">Stream Mode</Typography>
          <Typography variant="h5">
            {ChannelStreamModeToPrettyString[channel.streamMode]}
          </Typography>
        </Box>
      </Grid>
      <Grid size={{ xs: 12, md: 2 }} sx={{ p: 1 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="overline">
            Transcode Config{' '}
            <RouterLink
              to={`/settings/ffmpeg/$configId`}
              params={{ configId: transcodeConfig?.id ?? '' }}
            >
              {' '}
              <Launch sx={{ fontSize: 'inherit' }} />
            </RouterLink>
          </Typography>
          <Typography
            sx={{
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              overflow: 'hidden',
            }}
            variant="h5"
          >
            {transcodeConfig?.name}
          </Typography>
        </Box>
      </Grid>
    </Grid>
  );
};
