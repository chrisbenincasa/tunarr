import { type PaletteOptions, createTheme } from '@mui/material';

const LightTheme: PaletteOptions = {
  mode: 'light',
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
  // Trialing out default dark mode colors.
  // error: {
  //   main: '#ab6253',
  // },
  // warning: {
  //   main: '#FF9800',
  // },
  // info: {
  //   main: '#9EA1B3',
  // },
  // success: {
  //   main: '#0A772A',
  // },
};

export const Theme = createTheme({
  colorSchemes: {
    dark: {
      palette: DarkTheme,
    },
    light: {
      palette: LightTheme,
    },
  },
  defaultColorScheme: 'light',
});
