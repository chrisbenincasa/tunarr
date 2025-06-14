import { Autocomplete, TextField } from '@mui/material';
import type { BaseSlot } from '@tunarr/types/api';
import { find, first } from 'lodash-es';
import { useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import type {
  FillerProgramOption,
  ProgramOption,
} from '../../helpers/slotSchedulerUtil.ts';
import { pluralizeWithCount } from '../../helpers/util.ts';
import { SlotOrderFormControl } from './SlotOrderFormControl.tsx';

type Props = {
  programOptions: ProgramOption[];
};

export const FillerListSlotProgrammingForm = ({ programOptions }: Props) => {
  const { watch, control } = useFormContext<BaseSlot>();
  const type = watch('type');

  const fillerAutoCompleteOpts = useMemo(
    () =>
      type === 'filler'
        ? programOptions
            .filter((opt) => opt.type === 'filler')
            .map((opt) => ({ ...opt, label: opt.description }))
        : [],
    [programOptions, type],
  );

  return (
    <>
      <Controller
        control={control}
        name="fillerListId"
        render={({ field }) => {
          const value =
            find(fillerAutoCompleteOpts, {
              fillerListId: field.value,
            }) ?? first(fillerAutoCompleteOpts);
          return (
            <Autocomplete<FillerProgramOption & { label: string }>
              options={fillerAutoCompleteOpts}
              value={value}
              onChange={(_, value) =>
                value ? field.onChange(value.fillerListId) : void 0
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Filler"
                  helperText={`${pluralizeWithCount('program', value?.programCount)}`}
                />
              )}
            />
          );
        }}
      />
      <SlotOrderFormControl />
    </>
  );
};
