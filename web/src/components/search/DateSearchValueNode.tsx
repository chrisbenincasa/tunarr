import { Stack } from '@mui/material';
import type { PickerValidDate } from '@mui/x-date-pickers';
import { DatePicker } from '@mui/x-date-pickers';
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

export function DateSearchValueNode({ formKey }: Props) {
  const { control, watch } = useFormContext<SearchForm>();
  const currentSpec = watch(formKey);

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

  if (isNumber(currentSpec.value)) {
    return (
      <Controller
        control={control}
        name={`${formKey}.value`}
        render={({ field }) => (
          <DatePicker
            sx={{ height: 40 }}
            label="Value"
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
              label="Value"
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
              label="Value"
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
