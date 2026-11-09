import { useThemeTokens } from '@/hooks/useTunarrTheme.ts';
import { Trans, useLingui } from '@lingui/react/macro';
import { Delete, Edit, Refresh, VideoLibrary } from '@mui/icons-material';
import {
  Box,
  Button,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import type { MediaSourceSettings } from '@tunarr/types';
import { capitalize } from 'lodash-es';
import { RouterLink } from '../../base/RouterLink.tsx';
import { NetworkIcon } from '../../util/NetworkIcon.tsx';
import {
  type MediaSourceHealth,
  MediaSourceHealthPill,
} from './MediaSourceHealthPill.tsx';
import { MediaSourceLibrariesChip } from './MediaSourceLibrariesChip.tsx';
import { MediaSourceLocation } from './MediaSourceLocation.tsx';

export type MediaSourceCardProps = {
  source: MediaSourceSettings;
  health: MediaSourceHealth;
  onEdit: () => void;
  onRefreshLibraries: () => void;
  onEditLibraries: () => void;
  onDelete: () => void;
};

export const MediaSourceCard = ({
  source,
  health,
  onEdit,
  onRefreshLibraries,
  onEditLibraries,
  onDelete,
}: MediaSourceCardProps) => {
  const { t } = useLingui();
  const { theme, tokens, dense } = useThemeTokens();
  const remote = source.type !== 'local';

  return (
    <Box
      component="article"
      aria-label={source.name}
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
      <Stack direction="row" alignItems="center" gap={1}>
        {/* The Plex, Jellyfin and Emby logos are raw SVGs that ignore sx. */}
        <Box
          aria-hidden
          sx={{
            flex: 'none',
            display: 'flex',
            width: 20,
            height: 20,
            '& svg': { width: '100%', height: '100%' },
          }}
        >
          <NetworkIcon network={source.type} />
        </Box>
        <Typography
          variant="h2"
          sx={{
            fontSize: dense ? 15 : 17,
            fontWeight: 700,
            minWidth: 0,
            overflowWrap: 'anywhere',
          }}
        >
          <RouterLink
            to="/media_sources/$mediaSourceId"
            params={{ mediaSourceId: source.id }}
            color="inherit"
            underline="hover"
          >
            {source.name}
          </RouterLink>
        </Typography>
      </Stack>

      <Stack
        direction="row"
        alignItems="center"
        gap={1}
        flexWrap="wrap"
        sx={{ color: tokens.textMuted, fontSize: 13 }}
      >
        <span>{capitalize(source.type)}</span>
        <MediaSourceHealthPill health={health} />
        {remote && (
          <MediaSourceLibrariesChip
            mediaSource={source}
            onClick={onEditLibraries}
          />
        )}
      </Stack>

      <Typography
        title={source.type === 'local' ? source.paths.join('\n') : source.uri}
        sx={{
          color: tokens.textMuted,
          fontSize: 13,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        <MediaSourceLocation source={source} />
      </Typography>

      <Stack direction="row" gap={1} sx={{ mt: 'auto', pt: 0.5 }}>
        <Button
          variant="outlined"
          startIcon={<Edit />}
          aria-label={t`Edit ${source.name}`}
          onClick={onEdit}
          sx={{ flex: 1 }}
        >
          <Trans>Edit</Trans>
        </Button>
        {remote && (
          <>
            <Tooltip title={t`Refresh Libraries`} placement="top">
              <IconButton
                aria-label={t`Refresh libraries of ${source.name}`}
                onClick={onRefreshLibraries}
              >
                <Refresh />
              </IconButton>
            </Tooltip>
            <Tooltip title={t`Edit Libraries`} placement="top">
              <IconButton
                aria-label={t`Edit libraries of ${source.name}`}
                onClick={onEditLibraries}
              >
                <VideoLibrary />
              </IconButton>
            </Tooltip>
          </>
        )}
        <Tooltip title={t`Delete`} placement="top">
          <IconButton aria-label={t`Delete ${source.name}`} onClick={onDelete}>
            <Delete />
          </IconButton>
        </Tooltip>
      </Stack>
    </Box>
  );
};
