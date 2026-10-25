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
