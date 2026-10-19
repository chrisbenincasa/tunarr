import { Box, Stack, Typography, useTheme } from '@mui/material';
import type { ReactNode } from 'react';

export type PageHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
};

export const PageHeader = ({
  title,
  subtitle,
  eyebrow,
  actions,
}: PageHeaderProps) => {
  const theme = useTheme();

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      alignItems={{ xs: 'flex-start', sm: 'flex-end' }}
      justifyContent="space-between"
      gap={2}
      sx={{ mb: 3 }}
    >
      <Box sx={{ minWidth: 0 }}>
        {eyebrow && (
          <Typography variant="overline" color="text.secondary">
            {eyebrow}
          </Typography>
        )}
        <Typography
          variant="h1"
          sx={{
            fontSize: theme.sizes.pageTitle,
            lineHeight: 1.15,
            overflowWrap: 'anywhere',
          }}
        >
          {title}
        </Typography>
        {subtitle && (
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {actions && (
        <Stack direction="row" gap={1} flexWrap="wrap" sx={{ flex: 'none' }}>
          {actions}
        </Stack>
      )}
    </Stack>
  );
};
