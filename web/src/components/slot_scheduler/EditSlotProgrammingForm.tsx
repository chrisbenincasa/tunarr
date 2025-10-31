import type {
  ProgramOption,
  ProgramOptionType,
} from '@/helpers/slotSchedulerUtil';
import { ProgramOptionTypes } from '@/helpers/slotSchedulerUtil.ts';
import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import { filter, map, uniqBy } from 'lodash-es';
import { useMemo, useState } from 'react';
import type { FieldPath } from 'react-hook-form';
import { useFormContext } from 'react-hook-form';
import { useSlotProgramOptionsContext } from '../../hooks/programming_controls/useSlotProgramOptions.ts';
import { CustomShowSlotProgrammingForm } from './CustomShowSlotProgrammingForm.tsx';
import { FillerListSlotProgrammingForm } from './FillerListSlotProgrammingForm.tsx';
import { RedirectProgrammingForm } from './RedirectProgrammingForm.tsx';
import { ShowSearchSlotProgrammingForm } from './ShowSearchSlotProgrammingForm.tsx';
import { SlotOrderFormControl } from './SlotOrderFormControl.tsx';
import { SmartCollectionSlotProgrammingForm } from './SmartCollectionSlotProgrammingForm.tsx';

type EditSlotProgramProps<SlotT extends { type: ProgramOptionType }> = {
  newSlotForType: (type: ProgramOptionType) => SlotT;
};

export const EditSlotProgrammingForm = <
  SlotT extends { type: ProgramOptionType },
>({
  newSlotForType,
}: EditSlotProgramProps<SlotT>) => {
  const { watch, reset } = useFormContext<SlotT>();
  const type = watch('type' as FieldPath<SlotT>);
  const programOptions = useSlotProgramOptionsContext();
  const availableTypes = useMemo(() => {
    return map(
      uniqBy(programOptions, ({ type }) => type),
      'type',
    );
  }, [programOptions]);

  const [typeSelectValue, setTypeSelectValue] =
    useState<ProgramOptionType>(type);

  const handleTypeChange = (value: ProgramOptionType) => {
    if (value === typeSelectValue) {
      return;
    }

    setTypeSelectValue(value);

    const slot = newSlotForType(value);
    reset((prev) => ({ ...prev, ...slot }));
  };

  return (
    <>
      <FormControl fullWidth>
        <InputLabel>Type</InputLabel>
        <Select
          label="Type"
          value={typeSelectValue}
          onChange={(e) =>
            handleTypeChange(e.target.value as ProgramOption['type'])
          }
        >
          {map(
            filter(ProgramOptionTypes, ({ value }) =>
              availableTypes.includes(value),
            ),
            ({ value, description }) => (
              <MenuItem key={value} value={value}>
                {description}
              </MenuItem>
            ),
          )}
        </Select>
      </FormControl>
      {typeSelectValue === 'custom-show' && <CustomShowSlotProgrammingForm />}
      {typeSelectValue === 'smart-collection' && (
        <SmartCollectionSlotProgrammingForm />
      )}
      {typeSelectValue === 'filler' && <FillerListSlotProgrammingForm />}
      {typeSelectValue === 'show' && <ShowSearchSlotProgrammingForm />}
      {typeSelectValue === 'redirect' && <RedirectProgrammingForm />}
      {typeSelectValue === 'movie' && <SlotOrderFormControl />}
    </>
  );
};
