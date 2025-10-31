import { Autocomplete, TextField } from '@mui/material';
import { filter, find, first, map } from 'lodash-es';
import { useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import type { SmartCollectionOption } from '../../helpers/slotSchedulerUtil.ts';
import { useSlotProgramOptionsContext } from '../../hooks/programming_controls/useSlotProgramOptions.ts';
import type { CommonSmartCollectionViewModel } from '../../model/CommonSlotModels.ts';
import { SlotOrderFormControl } from './SlotOrderFormControl.tsx';

export const SmartCollectionSlotProgrammingForm = () => {
  const { watch, control } = useFormContext<CommonSmartCollectionViewModel>();
  const programOptions = useSlotProgramOptionsContext();
  const [type] = watch(['type']);

  const smartCollectionAutoCompleteOpts = useMemo(
    () =>
      type === 'smart-collection'
        ? map(
            filter(
              programOptions,
              (opt): opt is SmartCollectionOption =>
                opt.type === 'smart-collection',
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
        name="smartCollectionId"
        render={({ field }) => (
          <Autocomplete<SmartCollectionOption & { label: string }>
            options={smartCollectionAutoCompleteOpts}
            value={
              find(smartCollectionAutoCompleteOpts, {
                collectionId: field.value,
              }) ?? first(smartCollectionAutoCompleteOpts)
            }
            onChange={(_, value) =>
              value ? field.onChange(value.collectionId) : void 0
            }
            renderInput={(params) => (
              <TextField {...params} label="Smart Collection" />
            )}
          />
        )}
      />
      <SlotOrderFormControl />
    </>
  );
};
