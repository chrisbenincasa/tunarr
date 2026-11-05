import { useThemeTokens } from '@/hooks/useTunarrTheme.ts';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { Button, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { KeyHint } from '../../KeyHint.tsx';
import { MonoText } from '../../MonoText.tsx';

export type SelectionBarProps = {
  count: number;

  // Bulk action buttons. Shown only while something is selected.
  actions: ReactNode;
  onClear: () => void;

  // Shows the J/K/X/Enter hints for a table with keyboardNavigation.
  keyboardHints?: boolean;
};

// Sits above a collection's table and acts on its selected rows.
export const SelectionBar = ({
  count,
  actions,
  onClear,
  keyboardHints = false,
}: SelectionBarProps) => {
  const { t } = useLingui();
  const { theme, tokens } = useThemeTokens();

  return (
    <Stack
      role="region"
      aria-label={t`Selection`}
      direction="row"
      sx={{
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 1,
        minHeight: theme.sizes.controlHeightSmall + 14,
        px: 1.5,
        py: 0.75,
        mb: 1,
        border: `1px solid ${tokens.borderStrong}`,
        borderRadius: `${theme.sizes.radiusControl}px`,
        backgroundColor: tokens.surface,
      }}
    >
      {count > 0 ? (
        <>
          <Typography aria-live="polite" sx={{ fontWeight: 600 }}>
            <Plural
              value={count}
              one={
                <>
                  <MonoText>{count}</MonoText> selected
                </>
              }
              other={
                <>
                  <MonoText>{count}</MonoText> selected
                </>
              }
            />
          </Typography>
          {actions}
          <Button size="small" onClick={onClear}>
            <Trans>Clear</Trans>
          </Button>
        </>
      ) : (
        <Typography aria-live="polite" sx={{ color: tokens.textMuted }}>
          <Trans>Select rows to act on several at once.</Trans>
        </Typography>
      )}
      {keyboardHints && (
        <Typography
          component="span"
          sx={{
            ml: 'auto',
            color: tokens.textMuted,
            fontSize: 12,
            display: { xs: 'none', md: 'inline-flex' },
            alignItems: 'center',
            gap: 0.5,
          }}
        >
          <KeyHint>J</KeyHint>/<KeyHint>K</KeyHint> <Trans>move</Trans> ·{' '}
          <KeyHint>X</KeyHint> <Trans>select</Trans> · <KeyHint>Enter</KeyHint>{' '}
          <Trans>open</Trans>
        </Typography>
      )}
    </Stack>
  );
};
