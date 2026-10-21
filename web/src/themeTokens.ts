// Design tokens for the Tunarr UI. The MUI theme in theme.ts is built from
// these values; components should prefer theme values over these constants.

export type Density = 'comfortable' | 'dense';

export const fonts = {
  sans: "'IBM Plex Sans Variable', system-ui, -apple-system, 'Segoe UI', sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace",
} as const;

export type ColorTokens = {
  bg: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  accent: string;
  accentHover: string;
  accentInk: string;
  accentSoft: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  live: string;
};

export const darkColors: ColorTokens = {
  bg: '#0e1013',
  surface: '#171a1f',
  surfaceRaised: '#1f232a',
  border: '#22262d',
  borderStrong: '#2a2f37',
  text: '#eef1f4',
  textMuted: '#9aa3ae',
  textSubtle: '#6b7280',
  accent: '#2bc4cc',
  accentHover: '#4fd3da',
  accentInk: '#04282a',
  accentSoft: '#16282a',
  success: '#4ade80',
  warning: '#f5a524',
  error: '#ff9b8f',
  info: '#9cc8f5',
  live: '#ff6a4d',
};

export const lightColors: ColorTokens = {
  bg: '#fafaf9',
  surface: '#ffffff',
  surfaceRaised: '#f5f5f4',
  border: '#e7e5e4',
  borderStrong: '#d6d3d1',
  text: '#1c1917',
  textMuted: '#57534e',
  textSubtle: '#a8a29e',
  accent: '#0f766e',
  accentHover: '#115e59',
  accentInk: '#ffffff',
  accentSoft: '#ccfbf1',
  success: '#15803d',
  warning: '#b45309',
  error: '#b91c1c',
  info: '#1d4ed8',
  live: '#dc2626',
};

export type SizeTokens = {
  fontSize: number;
  pageTitle: number;
  spacing: number;
  controlHeight: number;
  controlHeightSmall: number;
  tableRowHeight: number;
  radiusCard: number;
  radiusControl: number;
  radiusSmall: number;
  cardPadding: number;
  navItemHeight: number;
  subTabHeight: number;
  shellPaddingY: number;
  shellPaddingX: number;
  pagePaddingY: number;
  pagePaddingX: number;
  shellBarHeight: number;
};

export const sizes: Record<Density, SizeTokens> = {
  comfortable: {
    fontSize: 14,
    pageTitle: 32,
    spacing: 8,
    controlHeight: 42,
    controlHeightSmall: 34,
    tableRowHeight: 52,
    radiusCard: 18,
    radiusControl: 12,
    radiusSmall: 8,
    cardPadding: 18,
    navItemHeight: 36,
    subTabHeight: 42,
    shellPaddingY: 14,
    shellPaddingX: 32,
    pagePaddingY: 28,
    pagePaddingX: 32,
    shellBarHeight: 64,
  },
  dense: {
    fontSize: 13,
    pageTitle: 20,
    spacing: 6,
    controlHeight: 34,
    controlHeightSmall: 28,
    tableRowHeight: 34,
    radiusCard: 12,
    radiusControl: 8,
    radiusSmall: 6,
    cardPadding: 12,
    navItemHeight: 30,
    subTabHeight: 34,
    shellPaddingY: 8,
    shellPaddingX: 24,
    pagePaddingY: 18,
    pagePaddingX: 24,
    shellBarHeight: 46,
  },
};

// Buttons, chips and toggle groups are pill-shaped at every density.
export const radiusPill = 999;
