import { useThemeTokens } from '@/hooks/useTunarrTheme.ts';
import { Chip } from '@mui/material';
import type { ReactElement, ReactNode } from 'react';

export type FilterChipProps = {
  label: ReactNode;
  icon?: ReactElement;
  selected: boolean;
  onClick: () => void;
};

// One toggle in a multi-select filter row. Use Segmented when exactly one
// option can be active.

export const FilterChip = ({
  label,
  icon,
  selected,
  onClick,
}: FilterChipProps) => {
  const { theme, tokens, dense } = useThemeTokens();

  return (
    <Chip
      label={label}
      icon={icon}
      variant="outlined"
      onClick={onClick}
      aria-pressed={selected}
      sx={{
        height: theme.sizes.controlHeightSmall,
        paddingInline: 0.5,
        fontSize: dense ? 12 : 13,
        color: selected ? tokens.accent : tokens.textMuted,
        borderColor: selected ? tokens.accent : tokens.borderStrong,
        backgroundColor: selected ? tokens.accentSoft : 'transparent',
        '& .MuiChip-icon': { color: 'inherit', fontSize: dense ? 16 : 18 },
        '&.MuiChip-clickable:hover': {
          backgroundColor: selected ? tokens.accentSoft : tokens.surfaceRaised,
        },
      }}
    />
  );
};
