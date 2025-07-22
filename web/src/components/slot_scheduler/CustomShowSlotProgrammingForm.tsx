import { Autocomplete, TextField } from '@mui/material';
import type { BaseSlot } from '@tunarr/types/api';
import { filter, find, first, map } from 'lodash-es';
import { useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import type {
  CustomShowProgramOption,
  ProgramOption,
} from '../../helpers/slotSchedulerUtil.ts';
import { SlotOrderFormControl } from './SlotOrderFormControl.tsx';

type Props = {
  programOptions: ProgramOption[];
};

export const CustomShowSlotProgrammingForm = ({ programOptions }: Props) => {
  const { watch, control } = useFormContext<BaseSlot>();
  const [type] = watch(['type']);

  const customShowAutoCompleteOpts = useMemo(
    () =>
      type === 'custom-show'
        ? map(
            filter(
              programOptions,
              (opt): opt is CustomShowProgramOption =>
                opt.type === 'custom-show',
            ),
            (opt) => ({
              ...opt,
              label: opt.description,
            }),
          )
        : [],
    [programOptions, type],
  );

  return (
    <>
      <Controller
        control={control}
        name="customShowId"
        render={({ field }) => (
          <Autocomplete<CustomShowProgramOption & { label: string }>
            options={customShowAutoCompleteOpts}
            value={
              find(customShowAutoCompleteOpts, {
                customShowId: field.value,
              }) ?? first(customShowAutoCompleteOpts)
            }
            onChange={(_, value) =>
              value ? field.onChange(value.customShowId) : void 0
            }
            renderInput={(params) => (
              <TextField {...params} label="Custom Show" />
            )}
          />
        )}
      />
      <SlotOrderFormControl />
    </>
  );
};
