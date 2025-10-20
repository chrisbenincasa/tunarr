import { Autocomplete, TextField } from '@mui/material';
import type { RedirectProgrammingTimeSlot } from '@tunarr/types/api';
import { filter, find, first, map } from 'lodash-es';
import { useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import type { RedirectProgramOption } from '../../helpers/slotSchedulerUtil.ts';
import { useSlotProgramOptionsContext } from '../../hooks/programming_controls/useSlotProgramOptions.ts';

export const RedirectProgrammingForm = () => {
  const { control } = useFormContext<RedirectProgrammingTimeSlot>();
  const programOptions = useSlotProgramOptionsContext();

  const redirectShowAutoCompleteOpts = useMemo(
    () =>
      map(
        filter(
          programOptions,
          (opt): opt is RedirectProgramOption => opt.type === 'redirect',
        ),
        (opt) => ({
          ...opt,
          label: opt.channelName,
        }),
      ),
    [programOptions],
  );

  return (
    <Controller
      control={control}
      name="channelId"
      render={({ field }) => (
        <Autocomplete<RedirectProgramOption & { label: string }>
          value={
            find(
              redirectShowAutoCompleteOpts,
              (opt) => opt.channelId === field.value,
            ) ?? first(redirectShowAutoCompleteOpts)
          }
          options={redirectShowAutoCompleteOpts}
          onChange={(_, value) =>
            value ? field.onChange(value.channelId) : void 0
          }
          renderInput={(params) => <TextField {...params} label="Program" />}
        />
      )}
    />
  );
};
