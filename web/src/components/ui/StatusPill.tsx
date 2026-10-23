import { Box, alpha } from '@mui/material';
import type { ReactNode } from 'react';
import { useThemeTokens } from '@/hooks/useTunarrTheme.ts';

export type StatusPillStatus = 'live' | 'idle' | 'warning' | 'error';

export type StatusPillProps = {
  status: StatusPillStatus;
  label: ReactNode;
};

export const StatusPill = ({ status, label }: StatusPillProps) => {
  const { tokens, dense } = useThemeTokens();
  const color = {
    live: tokens.success,
    idle: tokens.textMuted,
    warning: tokens.warning,
    error: tokens.error,
  }[status];

  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        maxWidth: '100%',
        px: dense ? 1 : 1.25,
        py: dense ? 0.125 : 0.25,
        borderRadius: 999,
        fontSize: dense ? 12 : 13,
        fontWeight: 600,
        lineHeight: 1.5,
        color,
        backgroundColor: alpha(color, 0.12),
        whiteSpace: 'nowrap',
      }}
    >
      <Box
        component="span"
        aria-hidden
        sx={{
          flex: 'none',
          width: 7,
          height: 7,
          borderRadius: '50%',
          backgroundColor: color,
        }}
      />
      <Box
        component="span"
        sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}
      >
        {label}
      </Box>
    </Box>
  );
};
