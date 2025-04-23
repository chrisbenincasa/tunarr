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
    main: '#00a0ab',
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
});

export const useTunarrTheme = () => {
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

export const useIsDarkMode = () => {
  return useColorScheme().mode === 'dark';
};
