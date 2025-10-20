import { Autocomplete, TextField } from '@mui/material';
import type { BaseSlot } from '@tunarr/types/api';
import { filter, find, first, map } from 'lodash-es';
import { useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import type {
  ProgramOption,
  ShowProgramOption,
} from '../../helpers/slotSchedulerUtil.ts';
import { SlotOrderFormControl } from './SlotOrderFormControl.tsx';

type Props = {
  programOptions: ProgramOption[];
};

export const ShowSlotProgrammingForm = ({ programOptions }: Props) => {
  const { watch, control } = useFormContext<BaseSlot>();
  const [type] = watch(['type']);

  const showAutoCompleteOpts = useMemo(
    () =>
      type === 'show'
        ? map(
            filter(
              programOptions,
              (opt): opt is ShowProgramOption => opt.type === 'show',
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
        name="showId"
        rules={{ required: true }}
        render={({ field }) => (
          <Autocomplete<ShowProgramOption & { label: string }>
            value={
              find(showAutoCompleteOpts, (opt) => opt.showId === field.value) ??
              first(showAutoCompleteOpts)
            }
            options={showAutoCompleteOpts}
            onChange={(_, value) =>
              value ? field.onChange(value.showId) : void 0
            }
            renderInput={(params) => <TextField {...params} label="Program" />}
          />
        )}
      />
      <SlotOrderFormControl />
    </>
  );
};
