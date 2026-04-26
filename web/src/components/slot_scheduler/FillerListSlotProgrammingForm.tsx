import { plural } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { Autocomplete, TextField } from '@mui/material';
import { find, first } from 'lodash-es';
import { useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import type { FillerProgramOption } from '../../helpers/slotSchedulerUtil.ts';
import { useSlotProgramOptionsContext } from '../../hooks/programming_controls/useSlotProgramOptions.ts';
import type { CommonFillerSlotViewModel } from '../../model/CommonSlotModels.ts';
import { SlotOrderFormControl } from './SlotOrderFormControl.tsx';

export const FillerListSlotProgrammingForm = () => {
  const { t } = useLingui();
  const programOptions = useSlotProgramOptionsContext();
  const { control } = useFormContext<CommonFillerSlotViewModel>();

  const fillerAutoCompleteOpts = useMemo(
    () =>
      programOptions
        .filter((opt) => opt.type === 'filler')
        .map((opt) => ({ ...opt, label: opt.description })),
    [programOptions],
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
              disabled={fillerAutoCompleteOpts.length === 0}
              options={fillerAutoCompleteOpts}
              value={value}
              onChange={(_, value) =>
                value ? field.onChange(value.fillerListId) : void 0
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t`Filler`}
                  helperText={plural(value?.programCount ?? 0, { one: '# program', other: '# programs' })}
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
