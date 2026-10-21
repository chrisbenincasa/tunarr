import { Box, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { useThemeTokens } from '@/hooks/useTunarrTheme.ts';

export type EmptyStateProps = {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
};

// Shown when a page or section has nothing to list yet. Say what goes here and
// offer the action that adds the first item.
export const EmptyState = ({
  title,
  description,
  icon,
  actions,
}: EmptyStateProps) => {
  const { tokens, dense } = useThemeTokens();
  const iconSize = dense ? 40 : 56;

  return (
    <Stack
      alignItems="center"
      textAlign="center"
      gap={dense ? 1 : 1.5}
      sx={{ py: dense ? 4 : 8, px: 2 }}
    >
      {icon && (
        <Box
          aria-hidden
          sx={{
            display: 'grid',
            placeItems: 'center',
            width: iconSize,
            height: iconSize,
            mb: 0.5,
            borderRadius: '50%',
            backgroundColor: tokens.accentSoft,
            color: tokens.accent,
            '& .MuiSvgIcon-root': { fontSize: dense ? 22 : 28 },
          }}
        >
          {icon}
        </Box>
      )}
      <Typography
        variant="h2"
        sx={{
          fontSize: dense ? 15 : 18,
          fontWeight: 600,
          lineHeight: 1.3,
          maxWidth: 480,
          overflowWrap: 'anywhere',
        }}
      >
        {title}
      </Typography>
      {description && (
        <Typography
          color="text.secondary"
          sx={{ maxWidth: 480, overflowWrap: 'anywhere' }}
        >
          {description}
        </Typography>
      )}
      {actions && (
        <Stack
          direction="row"
          gap={1}
          flexWrap="wrap"
          justifyContent="center"
          sx={{ mt: dense ? 0.5 : 1 }}
        >
          {actions}
        </Stack>
      )}
    </Stack>
  );
};
