import { plural } from '@lingui/core/macro';
import { Box } from '@mui/material';
import { radiusPill } from '../../../../themeTokens.ts';
import type { ShellNavBadge } from './navModel.ts';

const srOnly = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const;

export const NavBadge = ({ badge }: { badge: ShellNavBadge }) => (
  <Box
    component="span"
    sx={(theme) => ({
      position: 'relative',
      minWidth: 18,
      height: 18,
      px: '5px',
      borderRadius: `${radiusPill}px`,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: theme.typography.mono.fontFamily,
      fontSize: 11,
      fontWeight: 600,
      lineHeight: 1,
      color: theme.palette[badge.severity].contrastText,
      backgroundColor: theme.palette[badge.severity].main,
    })}
  >
    <span aria-hidden>{badge.count}</span>
    <Box component="span" sx={srOnly}>
      {plural(badge.count, {
        one: '(# health check issue)',
        other: '(# health check issues)',
      })}
    </Box>
  </Box>
);
