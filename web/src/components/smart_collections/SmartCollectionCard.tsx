import { isNonEmptyString } from '@/helpers/util.ts';
import { useThemeTokens } from '@/hooks/useTunarrTheme.ts';
import { Trans, useLingui } from '@lingui/react/macro';
import { Delete, Edit, Visibility } from '@mui/icons-material';
import {
  Box,
  Button,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import type { SmartCollection } from '@tunarr/types';
import { RouterButtonLink } from '../base/RouterButtonLink.tsx';
import { RouterLink } from '../base/RouterLink.tsx';
import { MonoText } from '../ui/MonoText.tsx';

export type SmartCollectionCardProps = {
  collection: Pick<
    SmartCollection,
    'uuid' | 'name' | 'keywords' | 'filterString'
  >;
  onEdit: () => void;
  onDelete: () => void;
};

export const SmartCollectionCard = ({
  collection,
  onEdit,
  onDelete,
}: SmartCollectionCardProps) => {
  const { t } = useLingui();
  const { theme, tokens, dense } = useThemeTokens();
  const hasKeywords = isNonEmptyString(collection.keywords);
  const hasFilter = isNonEmptyString(collection.filterString);

  return (
    <Box
      component="article"
      aria-label={collection.name}
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
          to="/library/smart_collections/$id"
          params={{ id: collection.uuid }}
          color="inherit"
          underline="hover"
        >
          {collection.name}
        </RouterLink>
      </Typography>

      {(hasKeywords || hasFilter) && (
        <Typography
          sx={{
            color: tokens.textMuted,
            fontSize: 13,
            overflowWrap: 'anywhere',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {hasKeywords && <>“{collection.keywords}” </>}
          {hasFilter && <MonoText>{collection.filterString}</MonoText>}
        </Typography>
      )}

      <Stack direction="row" gap={1} sx={{ mt: 'auto', pt: 0.5 }}>
        <RouterButtonLink
          to="/library/smart_collections/$id"
          params={{ id: collection.uuid }}
          variant="outlined"
          startIcon={<Visibility />}
          sx={{ flex: 1 }}
        >
          <Trans>View</Trans>
        </RouterButtonLink>
        <Button
          variant="outlined"
          startIcon={<Edit />}
          aria-label={t`Edit ${collection.name}`}
          onClick={onEdit}
          sx={{ flex: 1 }}
        >
          <Trans>Edit</Trans>
        </Button>
        <Tooltip title={t`Delete`} placement="top">
          <IconButton
            aria-label={t`Delete ${collection.name}`}
            onClick={onDelete}
          >
            <Delete />
          </IconButton>
        </Tooltip>
      </Stack>
    </Box>
  );
};
