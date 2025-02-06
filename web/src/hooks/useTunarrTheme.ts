import { createTheme, useMediaQuery } from '@mui/material';
import { isUndefined } from 'lodash-es';
import { useMemo } from 'react';
import useStore from '../store/index.ts';
import { setDarkModeState } from '../store/themeEditor/actions.ts';

export const useTunarrTheme = () => {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const darkMode = useStore((state) => state.theme.darkMode);

  // Fallback to browser preference if no user selection
  if (isUndefined(darkMode) && prefersDarkMode) {
    setDarkModeState();
  }

  return useMemo(
    () =>
      createTheme({
        palette: {
          ...(darkMode
            ? {
                mode: 'dark',
                primary: {
                  main: '#008c93',
                },
                secondary: {
                  main: '#004b79',
                },
                error: {
                  main: '#ab6253',
                },
                warning: {
                  main: '#FF9800',
                },
                info: {
                  main: '#9EA1B3',
                },
                success: {
                  main: '#0A772A',
                },
              }
            : {
                mode: 'light',
                background: {
                  default: '#f5fafc',
                },
                primary: {
                  main: '#008c93',
                },
                secondary: {
                  main: '#004b79',
                },
                error: {
                  main: '#892d22',
                },
                warning: {
                  main: '#FF9800',
                },
                info: {
                  main: '#9EA1B3',
                },
                success: {
                  main: '#0A772A',
                },
              }),
        },
      }),
    [darkMode],
  );
};
