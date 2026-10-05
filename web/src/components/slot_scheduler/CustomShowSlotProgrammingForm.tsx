import { isNonEmptyString } from '@/helpers/util.ts';
import { useLingui } from '@lingui/react/macro';
import { Autocomplete, TextField } from '@mui/material';
import { useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import type { CustomShowProgramOption } from '../../helpers/slotSchedulerUtil.ts';
import {
  customShowAvailability,
  isSelectableForNewSlot,
} from '../../helpers/slotSchedulerUtil.ts';
import { useSlotProgramOptionsContext } from '../../hooks/programming_controls/useSlotProgramOptions.ts';
import type { CommonCustomShowSlotViewModel } from '../../model/CommonSlotModels.ts';
import { SlotOrderFormControl } from './SlotOrderFormControl.tsx';

export const CustomShowSlotProgrammingForm = () => {
  const { t } = useLingui();
  const { control } = useFormContext<CommonCustomShowSlotViewModel>();
  const programOptions = useSlotProgramOptionsContext();

  const customShowOptions = useMemo(
    () =>
      programOptions.filter(
        (opt): opt is CustomShowProgramOption => opt.type === 'custom-show',
      ),
    [programOptions],
  );

  return (
    <>
      <Controller
        control={control}
        name="customShowId"
        render={({ field }) => {
          const hasSelection = isNonEmptyString(field.value);
          const availability = hasSelection
            ? customShowAvailability(programOptions, field.value)
            : undefined;

          // The saved show stays visible even when it can no longer be picked,
          // so the field never shows one show while holding another's ID.
          const selected: CustomShowProgramOption | null =
            customShowOptions.find((opt) => opt.customShowId === field.value) ??
            (hasSelection
              ? {
                  type: 'custom-show',
                  customShowId: field.value,
                  schedulableProgramCount: 0,
                  value: `custom-show.${field.value}`,
                  description: t`Deleted custom show`,
                }
              : null);

          const selectable = customShowOptions.filter(isSelectableForNewSlot);
          const options =
            selected !== null && availability !== 'available'
              ? [selected, ...selectable]
              : selectable;

          const helperText =
            availability === 'empty'
              ? t`This custom show has no programs. Add programs to it or choose another show.`
              : availability === 'missing'
                ? t`This custom show was deleted. Choose another show.`
                : undefined;

          return (
            <Autocomplete<CustomShowProgramOption>
              options={options}
              value={selected}
              getOptionLabel={(opt) => opt.description}
              getOptionDisabled={(opt) => !isSelectableForNewSlot(opt)}
              isOptionEqualToValue={(opt, value) =>
                opt.customShowId === value.customShowId
              }
              onChange={(_, value) =>
                value ? field.onChange(value.customShowId) : void 0
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t`Custom Show`}
                  error={
                    availability !== undefined && availability !== 'available'
                  }
                  helperText={helperText}
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
