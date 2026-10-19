import { type PaletteOptions, alpha, createTheme } from '@mui/material';
import type { CSSProperties } from 'react';
import {
  type ColorTokens,
  type Density,
  type SizeTokens,
  darkColors,
  fonts,
  lightColors,
  radiusPill,
  sizes,
} from './themeTokens.ts';

declare module '@mui/material/styles' {
  interface Theme {
    density: Density;
    sizes: SizeTokens;
  }
  interface ThemeOptions {
    density?: Density;
    sizes?: SizeTokens;
  }
  interface Palette {
    tokens: ColorTokens;
  }
  interface PaletteOptions {
    tokens?: ColorTokens;
  }
  interface TypographyVariants {
    mono: CSSProperties;
  }
  interface TypographyVariantsOptions {
    mono?: CSSProperties;
  }
}

declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    mono: true;
  }
}

const makePalette = (
  c: ColorTokens,
  mode: 'light' | 'dark',
): PaletteOptions => ({
  mode,
  primary: { main: c.accent, contrastText: c.accentInk },
  secondary: mode === 'dark' ? { main: '#8b7cf6' } : { main: '#6d28d9' },
  error: { main: c.error },
  warning: { main: c.warning },
  success: { main: c.success },
  info: { main: c.info },
  background: { default: c.bg, paper: c.surface },
  divider: c.border,
  text: { primary: c.text, secondary: c.textMuted, disabled: c.textSubtle },
  action: {
    hover: alpha(c.text, 0.06),
    selected: alpha(c.accent, 0.14),
  },
  tokens: c,
});

export const createTunarrTheme = (density: Density = 'comfortable') => {
  const s = sizes[density];
  const dense = density === 'dense';
  const small = dense ? 'small' : 'medium';

  return createTheme({
    colorSchemes: {
      dark: { palette: makePalette(darkColors, 'dark') },
      light: { palette: makePalette(lightColors, 'light') },
    },
    defaultColorScheme: 'light',
    density,
    sizes: s,
    spacing: s.spacing,

    // Kept small because MUI multiplies numeric sx radii by this value.
    // Component radii below are set in px.
    shape: { borderRadius: s.radiusSmall },

    typography: {
      fontFamily: fonts.sans,
      fontSize: s.fontSize,
      h1: { fontWeight: 700, letterSpacing: '-0.01em' },
      h2: { fontWeight: 700, letterSpacing: '-0.01em' },
      h3: { fontWeight: 700, letterSpacing: '-0.01em' },
      h4: { fontWeight: 700, letterSpacing: '-0.01em' },
      h5: { fontWeight: 700 },
      h6: { fontWeight: 700 },
      button: { textTransform: 'none', fontWeight: 600 },
      overline: { fontWeight: 700, letterSpacing: '0.08em' },
      mono: {
        fontFamily: fonts.mono,
        fontVariantNumeric: 'tabular-nums',
      },
    },

    components: {
      MuiCssBaseline: {
        styleOverrides: {
          'code, kbd, samp, pre': { fontFamily: fonts.mono },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
        },
      },
      MuiCard: {
        defaultProps: { variant: 'outlined' },
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: s.radiusCard,
            borderColor: theme.palette.divider,
          }),
        },
      },
      MuiCardContent: {
        styleOverrides: {
          root: {
            padding: s.cardPadding,
            '&:last-child': { paddingBottom: s.cardPadding },
          },
        },
      },
      MuiAppBar: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor: theme.palette.background.default,
            color: theme.palette.text.primary,
            borderBottom: `1px solid ${theme.palette.divider}`,
          }),
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: ({ theme }) => ({
            backgroundColor: theme.palette.background.default,
            borderColor: theme.palette.divider,
          }),
        },
      },
      MuiToolbar: {
        defaultProps: { variant: dense ? 'dense' : 'regular' },
      },

      MuiButton: {
        defaultProps: { disableElevation: true, size: small },
        styleOverrides: {
          root: { borderRadius: radiusPill, paddingInline: 16 },
          sizeSmall: { minHeight: s.controlHeightSmall, paddingInline: 12 },
          sizeMedium: { minHeight: s.controlHeight },
          outlined: ({ theme }) => ({
            borderColor: theme.palette.tokens.borderStrong,
          }),
          containedPrimary: ({ theme }) => ({
            '&:hover': { backgroundColor: theme.palette.tokens.accentHover },
          }),
        },
      },
      MuiIconButton: {
        defaultProps: { size: small },
      },
      MuiChip: {
        defaultProps: { size: small },
        styleOverrides: {
          root: { borderRadius: radiusPill, fontWeight: 600 },
        },
      },
      MuiToggleButtonGroup: {
        defaultProps: { size: 'small' },
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: radiusPill,
            padding: 3,
            gap: 2,
            border: `1px solid ${theme.palette.tokens.borderStrong}`,
          }),
          grouped: {
            border: 0,
            margin: 0,
            '&.MuiToggleButtonGroup-firstButton, &.MuiToggleButtonGroup-middleButton, &.MuiToggleButtonGroup-lastButton':
              { borderRadius: radiusPill, borderLeft: 0, marginLeft: 0 },
          },
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: ({ theme }) => ({
            textTransform: 'none',
            fontWeight: 600,
            paddingInline: 14,
            color: theme.palette.text.secondary,
            '&.Mui-selected, &.Mui-selected:hover': {
              backgroundColor: theme.palette.tokens.borderStrong,
              color: theme.palette.text.primary,
            },
          }),
        },
      },

      MuiTextField: {
        defaultProps: { size: small },
      },
      MuiFormControl: {
        defaultProps: { size: small },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: s.radiusControl,
            backgroundColor: theme.palette.background.paper,
          }),
          notchedOutline: ({ theme }) => ({
            borderColor: theme.palette.tokens.borderStrong,
          }),
        },
      },
      MuiCheckbox: {
        defaultProps: { size: small },
      },

      MuiTabs: {
        styleOverrides: {
          root: { minHeight: dense ? 40 : 48 },
          indicator: { height: 2, borderRadius: 2 },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            minHeight: dense ? 40 : 48,
          },
        },
      },

      MuiTable: {
        defaultProps: { size: small },
      },
      MuiTableCell: {
        styleOverrides: {
          root: ({ theme }) => ({ borderColor: theme.palette.divider }),
          head: ({ theme }) => ({
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: theme.palette.text.secondary,
          }),
          sizeSmall: { paddingBlock: 6, paddingInline: 12 },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: { height: s.tableRowHeight },
        },
      },

      MuiList: {
        defaultProps: { dense },
      },
      MuiMenuItem: {
        defaultProps: { dense },
        styleOverrides: {
          root: { borderRadius: s.radiusSmall, marginInline: 4 },
        },
      },
      MuiPopover: {
        styleOverrides: {
          paper: ({ theme }) => ({
            borderRadius: s.radiusControl,
            border: `1px solid ${theme.palette.tokens.borderStrong}`,
          }),
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: ({ theme }) => ({
            borderRadius: s.radiusCard,
            border: `1px solid ${theme.palette.divider}`,
          }),
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: ({ theme }) => ({
            fontSize: 12,
            borderRadius: s.radiusSmall,
            backgroundColor:
              theme.palette.mode === 'dark'
                ? theme.palette.tokens.borderStrong
                : theme.palette.tokens.text,
            color:
              theme.palette.mode === 'dark'
                ? theme.palette.tokens.text
                : theme.palette.tokens.bg,
          }),
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: s.radiusControl },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: { borderRadius: radiusPill, height: 4 },
        },
      },
    },
  });
};

export const Theme = createTunarrTheme('comfortable');
