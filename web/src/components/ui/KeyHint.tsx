import { Box, alpha, useTheme } from '@mui/material';
import type { ReactNode } from 'react';

export type KeyHintProps = {
  children: ReactNode;

  // Use 'onAccent' inside a contained primary button. Put the hint in the
  // button's children, not endIcon, because endIcon resizes it to 20px.
  tone?: 'default' | 'onAccent';
};

// One keyboard key, such as "N" or "⌘K". Put the action's words outside it.
export const KeyHint = ({ children, tone = 'default' }: KeyHintProps) => {
  const theme = useTheme();
  const tokens = theme.palette.tokens;
  const onAccent = tone === 'onAccent';

  return (
    <Box
      component="kbd"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '1.75em',
        paddingInline: '5px',
        boxSizing: 'border-box',
        borderRadius: '4px',
        border: '1px solid',
        borderColor: onAccent ? 'transparent' : tokens.borderStrong,
        backgroundColor: onAccent
          ? alpha(theme.palette.primary.contrastText, 0.15)
          : 'transparent',
        color: onAccent ? 'inherit' : tokens.textMuted,
        fontFamily: theme.typography.mono.fontFamily,
        fontSize: 11,
        fontWeight: 500,
        lineHeight: 1.6,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </Box>
  );
};
