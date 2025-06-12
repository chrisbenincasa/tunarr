import { useColorScheme } from '@mui/material';
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
