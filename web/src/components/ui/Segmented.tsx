import { ToggleButton, ToggleButtonGroup, useTheme } from '@mui/material';
import type { ReactNode } from 'react';

export type SegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
};

export type SegmentedProps<T extends string> = {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  'aria-label': string;
  fullWidth?: boolean;
  disabled?: boolean;
};

// Single choice from a short list. One option is always selected, so clicking
// the selected option does nothing.
export const Segmented = <T extends string>({
  options,
  value,
  onChange,
  'aria-label': ariaLabel,
  fullWidth,
  disabled,
}: SegmentedProps<T>) => {
  const theme = useTheme();
  const dense = theme.density === 'dense';

  // The group's padding and border take 8px, so the whole control matches a
  // small button's height.
  const buttonHeight = theme.sizes.controlHeightSmall - 8;

  return (
    <ToggleButtonGroup
      exclusive
      value={value}
      onChange={(_, next: unknown) => {
        const picked = options.find((option) => option.value === next);
        if (picked !== undefined) {
          onChange(picked.value);
        }
      }}
      aria-label={ariaLabel}
      fullWidth={fullWidth}
      disabled={disabled}
      sx={{ maxWidth: '100%' }}
    >
      {options.map((option) => (
        <ToggleButton
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          sx={{
            height: buttonHeight,
            gap: 0.75,
            paddingInline: dense ? 1.25 : 1.5,
            fontSize: dense ? 12 : 13,
            lineHeight: 1,
            whiteSpace: 'nowrap',
            '& .MuiSvgIcon-root': { fontSize: dense ? 16 : 18 },
          }}
        >
          {option.icon}
          {option.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
};
