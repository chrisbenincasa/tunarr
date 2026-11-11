import type { SxProps, Theme } from '@mui/material';

type SxArray = Extract<SxProps<Theme>, ReadonlyArray<unknown>>;

const isSxArray = (sx: SxProps<Theme>): sx is SxArray => Array.isArray(sx);

// Flattens an optional sx prop so it can join an sx array.
export const sxList = (sx: SxProps<Theme> | undefined): SxArray => {
  if (sx === undefined) {
    return [];
  }
  return isSxArray(sx) ? sx : [sx];
};

// Hides content on screen but keeps it for screen readers. Lengths are strings
// because sx reads a number up to 1 as a fraction, so width: 1 would mean 100%
// and widen the page.
export const visuallyHidden = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  margin: '-1px',
  padding: 0,
  border: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const;
