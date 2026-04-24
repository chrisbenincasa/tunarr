import { Trans, useLingui } from '@lingui/react/macro';
import {
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import type { BaseSlot } from '@tunarr/types/api';
import { find, map } from 'lodash-es';
import { useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { slotOrderOptions } from '../../helpers/slotSchedulerUtil.ts';
import { isNonEmptyString } from '../../helpers/util.ts';

export const SlotOrderFormControl = () => {
  const { t } = useLingui();
  const { watch, control } = useFormContext<BaseSlot>();
  const [type, order] = watch(['type', 'order']);

  const handleDirectionChange = (
    newDirection: string | null,
    originalOnChange: (...args: unknown[]) => void,
  ) => {
    if (newDirection) {
      originalOnChange(newDirection);
    }
  };

  const directionComponent = useMemo(() => {
    if (type === 'filler') {
      return (
        <Controller
          control={control}
          name="durationWeighting"
          render={({ field }) => {
            let helperText;
            switch (field.value) {
              case 'linear':
                helperText = t`Inverse linear decay, heavier weighting.`;
                break;
              case 'log':
                helperText = t`Logarithmic decay, lighter weighting.`;
                break;
            }

            return (
              <FormControl fullWidth>
                <InputLabel>{t`Weighting`}</InputLabel>
                <Select label={t`Weighting`} {...field}>
                  <MenuItem value="linear"><Trans>Linear</Trans></MenuItem>
                  <MenuItem value="log"><Trans>Logarithmic</Trans></MenuItem>
                </Select>
                {isNonEmptyString(helperText) && (
                  <FormHelperText>{helperText}</FormHelperText>
                )}
              </FormControl>
            );
          }}
        />
      );
    } else if (
      order === 'alphanumeric' ||
      order === 'next' ||
      order === 'ordered_shuffle' ||
      order === 'chronological'
    ) {
      return (
        <Controller
          control={control}
          name="direction"
          render={({ field }) => (
            <ToggleButtonGroup
              exclusive
              value={field.value}
              onChange={(_, value) =>
                handleDirectionChange(value as string | null, field.onChange)
              }
            >
              <ToggleButton value="asc"><Trans>Asc</Trans></ToggleButton>
              <ToggleButton value="desc"><Trans>Desc</Trans></ToggleButton>
            </ToggleButtonGroup>
          )}
        />
      );
    }
  }, [control, order, type, t]);

  if (type === 'flex' || type === 'redirect') {
    return null;
  }

  return (
    <Stack direction="row" spacing={2}>
      <Controller
        control={control}
        name="order"
        render={({ field }) => {
          const opts = slotOrderOptions(type);
          const helperText = find(opts, { value: field.value })?.helperText;
          return (
            <FormControl fullWidth>
              <InputLabel>{t`Order`}</InputLabel>
              <Select label={t`Order`} {...field}>
                {map(opts, ({ description, value }) => (
                  <MenuItem key={value} value={value}>
                    {description}
                  </MenuItem>
                ))}
              </Select>
              {helperText && <FormHelperText>{helperText}</FormHelperText>}
            </FormControl>
          );
        }}
      />

      {directionComponent}
    </Stack>
  );
};
