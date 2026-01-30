import { Stack } from '@mui/material';
import type { PickerValidDate } from '@mui/x-date-pickers';
import { DatePicker } from '@mui/x-date-pickers';
import { type DateSearchField } from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import { isNumber } from 'lodash-es';
import { useCallback } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import type { FieldKey, FieldPrefix } from '../../types/SearchBuilder.ts';
import type { SearchForm } from './SearchInput.tsx';

type Props = {
  field: DateSearchField;
  formKey: FieldKey<FieldPrefix, 'fieldSpec'>;
};

export function DateSearchValueNode({ field, formKey }: Props) {
  const { control } = useFormContext<SearchForm>();

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

  if (isNumber(field.value)) {
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
