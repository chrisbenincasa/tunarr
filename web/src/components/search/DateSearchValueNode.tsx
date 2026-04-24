import { useLingui } from '@lingui/react/macro';
import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from '@mui/material';
import type { PickerValidDate } from '@mui/x-date-pickers';
import { DatePicker } from '@mui/x-date-pickers';
import type { DateSearchField, RelativeDateUnit } from '@tunarr/types/schemas';
import { RelativeDateUnits } from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import { isNumber } from 'lodash-es';
import { useCallback } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import type { SearchFieldSpec } from '../../helpers/searchBuilderConstants.ts';
import type { FieldKey, FieldPrefix } from '../../types/SearchBuilder.ts';
import type { SearchForm } from './SearchInput.tsx';

type Props = {
  field: SearchFieldSpec<'date'>;
  formKey: FieldKey<FieldPrefix, 'fieldSpec'>;
};

const UnitLabels: Record<RelativeDateUnit, string> = {
  day: 'Days',
  week: 'Weeks',
  month: 'Months',
  year: 'Years',
};

function isRelativeDateOp(op: string): op is 'inthelast' | 'notinthelast' {
  return op === 'inthelast' || op === 'notinthelast';
}

export function DateSearchValueNode({ formKey }: Props) {
  const { t } = useLingui();
  const { control, watch, setValue } = useFormContext<SearchForm>();
  const currentSpec = watch(formKey) as DateSearchField;

  const handleDateValueChange = useCallback(
    (
      value: PickerValidDate | null,
      originalOnChange: (...args: unknown[]) => void,
    ) => {
      if (!value) return;

      originalOnChange(value.valueOf());
    },
    [],
  );

  const handleRelativeAmountChange = useCallback(
    (amount: number) => {
      const unit = currentSpec.relativeDate?.unit ?? 'week';
      const resolved = +dayjs().subtract(amount, unit);
      setValue(`${formKey}.value`, resolved);
      setValue(`${formKey}.relativeDate`, {
        op: currentSpec.op as 'inthelast' | 'notinthelast',
        amount,
        unit,
      });
    },
    [currentSpec.relativeDate?.unit, currentSpec.op, formKey, setValue],
  );

  const handleRelativeUnitChange = useCallback(
    (unit: RelativeDateUnit) => {
      const amount = currentSpec.relativeDate?.amount ?? 1;
      const resolved = +dayjs().subtract(amount, unit);
      setValue(`${formKey}.value`, resolved);
      setValue(`${formKey}.relativeDate`, {
        op: currentSpec.op as 'inthelast' | 'notinthelast',
        amount,
        unit,
      });
    },
    [currentSpec.relativeDate?.amount, currentSpec.op, formKey, setValue],
  );

  if (isRelativeDateOp(currentSpec.op)) {
    const amount = currentSpec.relativeDate?.amount ?? 1;
    const unit = currentSpec.relativeDate?.unit ?? 'week';

    return (
      <Stack direction="row" gap={1}>
        <TextField
          type="number"
          size="small"
          label={t`Amount`}
          value={amount}
          onChange={(e) => {
            const val = parseInt(e.target.value);
            if (!isNaN(val) && val > 0) {
              handleRelativeAmountChange(val);
            }
          }}
          slotProps={{ htmlInput: { min: 1 } }}
          sx={{ width: 100 }}
        />
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>{t`Unit`}</InputLabel>
          <Select
            value={unit}
            label={t`Unit`}
            onChange={(e) =>
              handleRelativeUnitChange(e.target.value as RelativeDateUnit)
            }
          >
            {RelativeDateUnits.map((u) => (
              <MenuItem key={u} value={u}>
                {UnitLabels[u]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>
    );
  }

  if (isNumber(currentSpec.value)) {
    return (
      <Controller
        control={control}
        name={`${formKey}.value`}
        render={({ field }) => (
          <DatePicker
            sx={{ height: 40 }}
            label={t`Value`}
            slotProps={{
              textField: {
                size: 'small',
              },
            }}
            value={dayjs(field.value as number)}
            onChange={(e) => handleDateValueChange(e, field.onChange)}
          />
        )}
      />
    );
  } else {
    return (
      <Stack direction="row" gap={1}>
        <Controller
          control={control}
          name={`${formKey}.value.0`}
          render={({ field }) => (
            <DatePicker
              sx={{ height: 40 }}
              label={t`Value`}
              maxDate={dayjs()}
              slotProps={{
                textField: {
                  size: 'small',
                },
              }}
              value={dayjs(field.value)}
              onChange={(e) => handleDateValueChange(e, field.onChange)}
            />
          )}
        />
        <Controller
          control={control}
          name={`${formKey}.value.1`}
          render={({ field }) => (
            <DatePicker
              sx={{ height: 40 }}
              label={t`Value`}
              slotProps={{
                textField: {
                  size: 'small',
                },
              }}
              value={dayjs(field.value as number)}
              onChange={(e) => handleDateValueChange(e, field.onChange)}
            />
          )}
        />
      </Stack>
    );
  }
}
