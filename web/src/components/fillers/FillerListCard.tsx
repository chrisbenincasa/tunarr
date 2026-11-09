import { useThemeTokens } from '@/hooks/useTunarrTheme.ts';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { Delete, Edit, PlaylistAdd } from '@mui/icons-material';
import {
  Box,
  Button,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import type { FillerList } from '@tunarr/types';
import { RouterButtonLink } from '../base/RouterButtonLink.tsx';
import { RouterLink } from '../base/RouterLink.tsx';
import { MonoText } from '../ui/MonoText.tsx';

export type FillerListCardProps = {
  filler: Pick<FillerList, 'id' | 'name' | 'contentCount'>;
  onAssignChannels: () => void;
  onDelete: () => void;
};

export const FillerListCard = ({
  filler,
  onAssignChannels,
  onDelete,
}: FillerListCardProps) => {
  const { t } = useLingui();
  const { theme, tokens, dense } = useThemeTokens();

  return (
    <Box
      component="article"
      aria-label={filler.name}
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
          to="/library/fillers/$fillerId/edit"
          params={{ fillerId: filler.id }}
          color="inherit"
          underline="hover"
        >
          {filler.name}
        </RouterLink>
      </Typography>

      <Typography sx={{ color: tokens.textMuted, fontSize: 13 }}>
        <MonoText>{filler.contentCount}</MonoText>{' '}
        <Plural value={filler.contentCount} one="program" other="programs" />
      </Typography>

      <Stack direction="row" gap={1} sx={{ mt: 'auto', pt: 0.5 }}>
        <RouterButtonLink
          to="/library/fillers/$fillerId/edit"
          params={{ fillerId: filler.id }}
          variant="outlined"
          startIcon={<Edit />}
          sx={{ flex: 1 }}
        >
          <Trans>Edit</Trans>
        </RouterButtonLink>
        <Button
          variant="outlined"
          startIcon={<PlaylistAdd />}
          aria-label={t`Assign ${filler.name} to channels`}
          onClick={onAssignChannels}
          sx={{ flex: 1 }}
        >
          <Trans>Assign</Trans>
        </Button>
        <Tooltip title={t`Delete`} placement="top">
          <IconButton aria-label={t`Delete ${filler.name}`} onClick={onDelete}>
            <Delete />
          </IconButton>
        </Tooltip>
      </Stack>
    </Box>
  );
};
