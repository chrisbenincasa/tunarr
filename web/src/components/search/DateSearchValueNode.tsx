import { Stack } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import type { MediaSourceLibrary } from '@tunarr/types';
import type { SearchRequest } from '@tunarr/types/api';
import { type DateSearchField } from '@tunarr/types/api';
import dayjs from 'dayjs';
import { isNumber } from 'lodash-es';
import { Controller, useFormContext } from 'react-hook-form';
import type { FieldKey, FieldPrefix } from '../../types/SearchBuilder.ts';

type Props = {
  field: DateSearchField;
  formKey: FieldKey<FieldPrefix, 'fieldSpec'>;
  library?: MediaSourceLibrary;
};

export function DateSearchValueNode({ field, formKey }: Props) {
  const { control } = useFormContext<SearchRequest>();

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
            onChange={(e) => field.onChange(e?.valueOf())}
          />
        )}
      />
    );
  } else {
    return (
      <Stack direction="row">
        <Controller
          control={control}
          name={`${formKey}.value.0`}
          render={({ field }) => (
            <DatePicker
              sx={{ height: 40 }}
              label="Value"
              // maxDate={dayjs(
              //   (selfValue.fieldSpec.value as [number, number])[1] - 1,
              // )}
              maxDate={dayjs()}
              slotProps={{
                textField: {
                  size: 'small',
                },
              }}
              value={dayjs(field.value)}
              onChange={(e) => field.onChange(e?.valueOf())}
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
              // minDate={dayjs((field.value as [number, number])[0] + 1)}
              // maxDate={dayjs()}
              slotProps={{
                textField: {
                  size: 'small',
                },
              }}
              value={dayjs(field.value as number)}
              onChange={(e) => field.onChange(e?.valueOf())}
            />
          )}
        />
      </Stack>
    );
  }
}
