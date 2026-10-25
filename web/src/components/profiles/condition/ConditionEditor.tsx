import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { Controller, useFormContext } from 'react-hook-form';
import type { StreamSelectionProfileFormValues } from '../streamSelectionFormTypes.ts';
import type { ConditionGroup, ConditionMode } from './types.ts';
import { createDefaultGroup } from './types.ts';
import { celToBasicCondition } from './celParser.ts';
import { basicConditionToCel } from './celGenerator.ts';
import { ConditionGroupEditor } from './ConditionGroupEditor.tsx';

interface Props {
  index: number;
  onValidateCondition: (value: string) => Promise<string | undefined>;
}

export function ConditionEditor({ index, onValidateCondition }: Props) {
  const { control, setValue, getValues } =
    useFormContext<StreamSelectionProfileFormValues>();

  const prefix = `rules.${index}` as const;

  // Try to parse the current CEL value on mount
  const initialCel = getValues(`${prefix}.condition`);
  const initialParsed = useMemo(() => celToBasicCondition(initialCel), [initialCel]);

  const [mode, setMode] = useState<ConditionMode>(
    initialParsed ? 'basic' : 'cel',
  );
  const [basicCondition, setBasicCondition] = useState<ConditionGroup>(
    initialParsed ?? createDefaultGroup(),
  );
  const [switchError, setSwitchError] = useState<string | null>(null);

  // Sync basic condition changes to the form's condition field
  const updateFromBasic = useCallback(
    (group: ConditionGroup) => {
      setBasicCondition(group);
      const cel = basicConditionToCel(group);
      setValue(`${prefix}.condition`, cel, {
        shouldValidate: true,
        shouldDirty: true,
      });
    },
    [prefix, setValue],
  );

  // When first mounting in basic mode, ensure the form field matches
  useEffect(() => {
    if (mode === 'basic') {
      const cel = basicConditionToCel(basicCondition);
      const current = getValues(`${prefix}.condition`);
      if (cel !== current) {
        setValue(`${prefix}.condition`, cel, { shouldDirty: true });
      }
    }
    // Only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleModeChange = (
    _: React.MouseEvent<HTMLElement>,
    newMode: ConditionMode | null,
  ) => {
    if (newMode === null) return;
    setSwitchError(null);

    if (newMode === 'basic') {
      // Try to parse the current CEL string
      const currentCel = getValues(`${prefix}.condition`);
      const parsed = celToBasicCondition(currentCel);
      if (parsed) {
        setBasicCondition(parsed);
        setMode('basic');
      } else {
        setSwitchError(
          t`This expression can't be represented in Basic mode. Edit it in CEL mode or simplify it first.`,
        );
      }
    } else {
      // Switching to CEL — condition field already has the generated string
      setMode('cel');
    }
  };

  return (
    <Stack spacing={2}>
      {/* Mode toggle */}
      <Stack direction="row" spacing={2} alignItems="center">
        <Typography variant="subtitle2">
          <Trans>Condition</Trans>
        </Typography>
        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={handleModeChange}
          size="small"
        >
          <ToggleButton
            value="basic"
            sx={{ px: 1.5, py: 0.25, textTransform: 'none' }}
          >
            <Trans>Basic</Trans>
          </ToggleButton>
          <ToggleButton
            value="cel"
            sx={{ px: 1.5, py: 0.25, textTransform: 'none' }}
          >
            <Trans>CEL</Trans>
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {switchError && (
        <Alert severity="warning" onClose={() => setSwitchError(null)}>
          {switchError}
        </Alert>
      )}

      {mode === 'basic' ? (
        <Box>
          <ConditionGroupEditor
            group={basicCondition}
            onChange={updateFromBasic}
          />
        </Box>
      ) : (
        <Controller
          control={control}
          name={`${prefix}.condition`}
          rules={{
            required: t`Condition is required`,
            validate: async (value) => {
              if (!value) return t`Condition is required`;
              const result = await onValidateCondition(value);
              return result ?? true;
            },
          }}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              label={t`CEL Expression`}
              helperText={
                error?.message ??
                t`CEL expression. Use "true" to always match.`
              }
              error={!!error}
              size="small"
              placeholder="true"
              fullWidth
              multiline
              minRows={1}
              maxRows={4}
            />
          )}
        />
      )}
    </Stack>
  );
}
