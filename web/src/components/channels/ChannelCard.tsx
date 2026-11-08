import { betterHumanize } from '@/helpers/dayjs.ts';
import { useThemeTokens } from '@/hooks/useTunarrTheme.ts';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { PlayArrow } from '@mui/icons-material';
import {
  Box,
  Chip,
  LinearProgress,
  Stack,
  Typography,
  alpha,
} from '@mui/material';
import { common } from '@mui/material/colors';
import type { Channel } from '@tunarr/types';
import dayjs from 'dayjs';
import { type ReactNode, useState } from 'react';
import { isNonEmptyString } from '../../helpers/util.ts';
import { RouterButtonLink } from '../base/RouterButtonLink.tsx';
import { RouterLink } from '../base/RouterLink.tsx';
import { MonoText } from '../ui/MonoText.tsx';
import { ChannelIconDisplay } from './ChannelIconDisplay.tsx';
import { ChannelStatusPill } from './ChannelStatusPill.tsx';
import {
  type ChannelStatus,
  type NowPlayingSummary,
  streamModeLabel,
} from './channelSummary.ts';

export type ChannelCardChannel = Pick<
  Channel,
  | 'id'
  | 'number'
  | 'name'
  | 'icon'
  | 'programCount'
  | 'duration'
  | 'stealth'
  | 'onDemand'
  | 'streamMode'
>;

export type ChannelCardProps = {
  channel: ChannelCardChannel;
  status: ChannelStatus;
  nowPlaying?: NowPlayingSummary;
  transcodeName?: string;
  onOpenSessions?: () => void;

  // Overflow menu button for the channel's other actions.
  menu?: ReactNode;
};

// Text over artwork sits on a dark scrim, so it stays white in both schemes.
const scrim = alpha(common.black, 0.55);
const BLANK_LINE = '\u00a0';

export const ChannelCard = ({
  channel,
  status,
  nowPlaying,
  transcodeName,
  onOpenSessions,
  menu,
}: ChannelCardProps) => {
  const { t } = useLingui();
  const { theme, tokens, dense } = useThemeTokens();
  const [failedArtUrl, setFailedArtUrl] = useState<string>();
  const artworkUrl =
    nowPlaying?.artworkUrl === failedArtUrl
      ? undefined
      : nowPlaying?.artworkUrl;
  const heroHeight = dense ? 104 : 140;

  const nowTitle =
    nowPlaying?.kind === 'redirect'
      ? t`Redirect to channel ${nowPlaying.redirectChannel}`
      : nowPlaying?.title;
  const hasNowTitle = isNonEmptyString(nowTitle);
  const nowDetail = nowPlaying?.detail;

  return (
    <Box
      component="article"
      aria-label={channel.name}
      sx={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: tokens.surface,
        border: `1px solid ${tokens.border}`,
        borderRadius: `${theme.sizes.radiusCard}px`,
      }}
    >
      <Box
        sx={{
          position: 'relative',
          minHeight: heroHeight,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: 1,
          p: dense ? 1 : 1.75,
          backgroundColor: tokens.surfaceRaised,
          color: common.white,
        }}
      >
        {artworkUrl ? (
          <Box
            component="img"
            src={artworkUrl}
            alt=""
            loading="lazy"
            onError={() => setFailedArtUrl(artworkUrl)}
            sx={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              opacity: 0.35,
            }}
          >
            <ChannelIconDisplay
              icon={channel.icon}
              imgStyle={{ maxHeight: heroHeight / 2, maxWidth: '50%' }}
              style={{ height: heroHeight / 2 }}
            />
          </Box>
        )}

        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ position: 'relative' }}
        >
          <Box
            sx={{
              minWidth: dense ? 34 : 44,
              height: dense ? 34 : 44,
              px: 1,
              boxSizing: 'border-box',
              display: 'grid',
              placeItems: 'center',
              borderRadius: `${theme.sizes.radiusControl}px`,
              backgroundColor: scrim,
            }}
          >
            <MonoText sx={{ fontWeight: 600, fontSize: dense ? 15 : 18 }}>
              {channel.number}
            </MonoText>
          </Box>
          <Box sx={{ borderRadius: 999, backgroundColor: scrim }}>
            <ChannelStatusPill
              status={status}
              onOpenSessions={onOpenSessions}
            />
          </Box>
        </Stack>

        {/* The box keeps all three lines, even when they are blank, so every
            card's artwork area has the same height. */}
        <Box
          aria-hidden={!hasNowTitle}
          sx={{
            visibility: hasNowTitle ? 'visible' : 'hidden',
            position: 'relative',
            alignSelf: 'flex-start',
            maxWidth: '100%',
            minWidth: 0,
            px: 1.5,
            py: 1,
            borderRadius: `${theme.sizes.radiusSmall}px`,
            backgroundColor: scrim,
          }}
        >
          <Typography
            sx={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              opacity: 0.85,
            }}
          >
            {hasNowTitle ? <Trans>Now playing</Trans> : BLANK_LINE}
          </Typography>
          <Typography
            noWrap
            sx={{ fontWeight: 700, fontSize: dense ? 14 : 15 }}
          >
            {hasNowTitle ? nowTitle : BLANK_LINE}
          </Typography>
          <Typography noWrap sx={{ fontSize: 12, opacity: 0.85 }}>
            {isNonEmptyString(nowDetail) ? nowDetail : BLANK_LINE}
          </Typography>
        </Box>
      </Box>

      <LinearProgress
        variant="determinate"
        value={(nowPlaying?.progress ?? 0) * 100}
        aria-label={t`Program progress`}
        sx={{
          height: 3,
          borderRadius: 0,
          backgroundColor: tokens.borderStrong,
        }}
      />

      <Stack
        gap={dense ? 0.75 : 1.25}
        sx={{ flex: 1, p: dense ? 1.25 : 2, pt: dense ? 1 : 1.75 }}
      >
        <Typography
          variant="h2"
          sx={{
            fontSize: dense ? 15 : 17,
            fontWeight: 700,
            overflowWrap: 'anywhere',
          }}
        >
          <RouterLink
            to="/channels/$channelId"
            params={{ channelId: channel.id }}
            color="inherit"
            underline="hover"
          >
            {channel.name}
          </RouterLink>
        </Typography>

        <Typography sx={{ color: tokens.textMuted, fontSize: 13 }}>
          <MonoText>{channel.programCount}</MonoText>{' '}
          <Plural value={channel.programCount} one="program" other="programs" />{' '}
          ·{' '}
          <MonoText>
            {betterHumanize(dayjs.duration(channel.duration), {
              style: 'short',
            })}
          </MonoText>
        </Typography>

        <Stack direction="row" gap={0.75} flexWrap="wrap">
          <Chip
            size="small"
            label={streamModeLabel(channel.streamMode)}
            sx={{ fontFamily: theme.typography.mono.fontFamily }}
          />
          {transcodeName && <Chip size="small" label={transcodeName} />}
          {channel.stealth && (
            <Chip size="small" color="warning" label={t`Stealth`} />
          )}
          {channel.onDemand.enabled && (
            <Chip size="small" color="info" label={t`On-Demand`} />
          )}
        </Stack>

        <Stack direction="row" gap={1} sx={{ mt: 'auto', pt: 0.5 }}>
          <RouterButtonLink
            to="/channels/$channelId/watch"
            params={{ channelId: channel.id }}
            variant="outlined"
            startIcon={<PlayArrow />}
            sx={{ flex: 1 }}
          >
            <Trans>Watch</Trans>
          </RouterButtonLink>
          <RouterButtonLink
            to="/channels/$channelId/programming"
            params={{ channelId: channel.id }}
            variant="outlined"
            sx={{ flex: 1 }}
          >
            <Trans>Programming</Trans>
          </RouterButtonLink>
          {menu}
        </Stack>
      </Stack>
    </Box>
  );
};
