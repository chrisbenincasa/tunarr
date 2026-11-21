import { betterHumanize } from '@/helpers/dayjs.ts';
import { useThemeTokens } from '@/hooks/useTunarrTheme.ts';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { Delete, Edit } from '@mui/icons-material';
import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import type { CustomShow } from '@tunarr/types';
import dayjs from 'dayjs';
import { RouterButtonLink } from '../base/RouterButtonLink.tsx';
import { RouterLink } from '../base/RouterLink.tsx';
import { MonoText } from '../ui/MonoText.tsx';
import { StatusPill } from '../ui/StatusPill.tsx';

export type CustomShowCardShow = Pick<
  CustomShow,
  | 'id'
  | 'name'
  | 'contentCount'
  | 'totalDuration'
  | 'syncMediaSourceId'
  | 'isSyncing'
>;

export type CustomShowCardProps = {
  show: CustomShowCardShow;
  onDelete: () => void;
};

export const CustomShowCard = ({ show, onDelete }: CustomShowCardProps) => {
  const { t } = useLingui();
  const { theme, tokens, dense } = useThemeTokens();

  return (
    <Box
      component="article"
      aria-label={show.name}
      sx={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: dense ? 0.75 : 1.25,
        p: dense ? 1.25 : 2,
        backgroundColor: tokens.surface,
        border: `1px solid ${tokens.border}`,
        borderRadius: `${theme.sizes.radiusCard}px`,
      }}
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
          to="/library/playlists/$showId/edit"
          params={{ showId: show.id }}
          color="inherit"
          underline="hover"
        >
          {show.name}
        </RouterLink>
      </Typography>

      <Typography sx={{ color: tokens.textMuted, fontSize: 13 }}>
        <MonoText>{show.contentCount}</MonoText>{' '}
        <Plural value={show.contentCount} one="program" other="programs" /> ·{' '}
        <MonoText>
          {betterHumanize(dayjs.duration(show.totalDuration), {
            style: 'short',
          })}
        </MonoText>
      </Typography>

      {show.syncMediaSourceId && (
        <Box>
          <StatusPill
            status={show.isSyncing ? 'live' : 'idle'}
            label={show.isSyncing ? t`Syncing` : t`Synced`}
          />
        </Box>
      )}

      <Stack direction="row" gap={1} sx={{ mt: 'auto', pt: 0.5 }}>
        <RouterButtonLink
          to="/library/playlists/$showId/edit"
          params={{ showId: show.id }}
          variant="outlined"
          startIcon={<Edit />}
          sx={{ flex: 1 }}
        >
          <Trans>Edit</Trans>
        </RouterButtonLink>
        <Tooltip title={t`Delete`} placement="top">
          <IconButton aria-label={t`Delete ${show.name}`} onClick={onDelete}>
            <Delete />
          </IconButton>
        </Tooltip>
      </Stack>
    </Box>
  );
};
