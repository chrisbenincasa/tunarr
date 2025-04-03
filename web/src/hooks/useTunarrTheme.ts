import type { PaletteOptions } from '@mui/material';
import { createTheme, useColorScheme } from '@mui/material';
import useStore from '../store/index.ts';

const LightTheme: PaletteOptions = {
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
};

const DarkTheme: PaletteOptions = {
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
};

const Theme = createTheme({
  colorSchemes: {
    dark: {
      palette: DarkTheme,
    },
    light: {
      palette: LightTheme,
    },
  },
  // colorSchemes: {
  //   dark: true,
  //   light: true,
  // },
  // palette: darkMode ? DarkTheme : LightTheme,
});

export const useTunarrTheme = () => {
  // const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  // const { mode, setMode } = useColorScheme();
  // const darkMode = useStore((state) => state.theme.darkMode);
  // const schemePreference = useStore(
  //   (state) => state.theme.themePreference ?? 'system',
  // );

  // Fallback to browser preference if no user selection
  // if (isUndefined(darkMode) && prefersDarkMode) {
  //   toggleDarkMode();
  //   setMode('dark');
  // }
  const { mode, setMode } = useColorScheme();
  const preference = useStore(
    (state) => state.theme.themePreference ?? 'system',
  );
  if (mode !== preference) {
    setMode(preference);
  }

  return Theme;
};

export const useSetColorScheme = () => {
  return useColorScheme().setColorScheme;
};
