import { Typography, type TypographyProps } from '@mui/material';

export type MonoTextProps = Omit<TypographyProps, 'variant'>;

// Channel numbers, times and durations. Tabular digits keep columns aligned.
export const MonoText = (props: MonoTextProps) => (
  <Typography component="span" variant="mono" {...props} />
);
