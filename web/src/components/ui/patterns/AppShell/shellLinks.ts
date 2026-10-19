import { ButtonBase, MenuItem, styled } from '@mui/material';
import { createLink } from '@tanstack/react-router';
import { radiusPill } from '../../../../themeTokens.ts';

export const LinkButtonBase = createLink(ButtonBase);
export const LinkMenuItem = createLink(MenuItem);

export type ShellIconButtonVariant = 'outlined' | 'plain';

// Round icon button used for search, color mode, help and Settings.
// `outlined` is the desktop bar style. `plain` is the larger phone header style.
export const ShellIconButton = styled(ButtonBase, {
  shouldForwardProp: (prop) => prop !== 'variant' && prop !== 'current',
})<{ variant?: ShellIconButtonVariant; current?: boolean }>(({
  theme,
  variant = 'outlined',
  current = false,
}) => {
  const t = theme.palette.tokens;
  const size = variant === 'plain' ? 44 : theme.sizes.navItemHeight;
  return {
    flex: 'none',
    width: size,
    height: size,
    borderRadius: radiusPill,
    color: theme.palette.text.primary,
    border:
      variant === 'plain'
        ? 0
        : `1px solid ${current ? t.text : t.borderStrong}`,
    backgroundColor:
      variant === 'plain' ? 'transparent' : current ? t.border : t.surface,
    '& svg': { fontSize: variant === 'plain' ? 20 : 18 },
    '&:hover': { backgroundColor: t.surfaceRaised },
    '&.Mui-focusVisible': {
      outline: `2px solid ${t.accent}`,
      outlineOffset: 2,
    },
  };
});

export const LinkShellIconButton = createLink(ShellIconButton);

export const shortcutLabel = (isMac: boolean) => (isMac ? '⌘K' : 'Ctrl K');
