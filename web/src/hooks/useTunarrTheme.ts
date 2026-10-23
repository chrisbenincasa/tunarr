import { useColorScheme, useTheme } from '@mui/material';
import { useMemo } from 'react';
import { Theme } from '../theme.ts';

export const useTunarrTheme = () => {
  return useMemo(() => Theme, []);
};

export const useSetColorScheme = () => {
  return useColorScheme().setColorScheme;
};

export const useIsDarkMode = () => {
  return useColorScheme().colorScheme === 'dark';
};

// The theme values the UI primitives read on every render.
export const useThemeTokens = () => {
  const theme = useTheme();

  return {
    theme,
    tokens: theme.palette.tokens,
    dense: theme.density === 'dense',
  };
};
