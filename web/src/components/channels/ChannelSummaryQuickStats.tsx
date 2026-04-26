import { Launch } from '@mui/icons-material';
import { Box, Grid, Paper, Stack, Typography } from '@mui/material';
import { Trans } from '@lingui/react/macro';
import { plural, t } from '@lingui/core/macro';
import { seq } from '@tunarr/shared/util';
import type { ChannelStreamMode } from '@tunarr/types';
import * as globalDayjs from 'dayjs';
import { find, round, uniq } from 'lodash-es';
import { useMemo } from 'react';
import { match } from 'ts-pattern';
import { useTranscodeConfigs } from '../../hooks/settingsHooks.ts';
import { useChannelAndProgramming } from '../../hooks/useChannelLineup.ts';
import { RouterLink } from '../base/RouterLink.tsx';

const ChannelStreamModeToPrettyString: Record<ChannelStreamMode, string> = {
  hls: 'HLS',
  hls_direct: 'HLS Direct',
  hls_direct_v2: 'HLS Direct v2',
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
            .with({ type: 'content' }, ({ id }) => id)
            .with({ type: 'custom' }, ({ program }) => program?.id)
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
      return t`0 mins`;
    }

    const days = round(dur.asDays(), 2);
    if (days >= 1) {
      return t`${plural(days, { one: '# day', other: '# days' })}`;
    }

    const hours = round(dur.asHours());
    if (hours >= 1) {
      return t`${plural(hours, { one: '# hour', other: '# hours' })}`;
    }

    const minutes = round(dur.asMinutes(), 2);
    return t`${plural(minutes, { one: '# minute', other: '# minutes' })}`;
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
      <Grid size={{ xs: 12, md: 4 }} sx={{ p: [0.5, 1] }}>
        <Stack direction="row">
          <div>
            <Typography variant="overline">
              <Trans>Total Runtime</Trans>
            </Typography>
            <Typography variant="h5">{channelDurationString}</Typography>
          </div>
          <Box></Box>
        </Stack>
      </Grid>
      <Grid size={{ xs: 12, md: 4 }} sx={{ p: [0.5, 1] }}>
        <Stack direction="row">
          <div>
            <Typography variant="overline">
              <Trans>Programs</Trans>
            </Typography>
            <Typography variant="h5">{uniqPrograms}</Typography>
          </div>
        </Stack>
      </Grid>
      <Grid size={{ xs: 12, md: 2 }} sx={{ p: [0.5, 1] }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="overline">
            <Trans>Stream Mode</Trans>
          </Typography>
          <Typography variant="h5">
            {ChannelStreamModeToPrettyString[channel.streamMode]}
          </Typography>
        </Box>
      </Grid>
      <Grid size={{ xs: 12, md: 2 }} sx={{ p: [0.5, 1] }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="overline">
            <Trans>
              Transcode Config{' '}
              <RouterLink
                to={`/settings/ffmpeg/$configId`}
                params={{ configId: transcodeConfig?.id ?? '' }}
              >
                {' '}
                <Launch sx={{ fontSize: 'inherit' }} />
              </RouterLink>
            </Trans>
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
