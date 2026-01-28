import type {
  ProgramOption,
  ProgramOptionType,
} from '@/helpers/slotSchedulerUtil';
import { ProgramOptionTypes } from '@/helpers/slotSchedulerUtil.ts';
import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import type { Season, Show } from '@tunarr/types';
import { filter, map, uniqBy } from 'lodash-es';
import { useCallback, useMemo, useState } from 'react';
import { useController, useFormContext } from 'react-hook-form';
import { useSlotProgramOptionsContext } from '../../hooks/programming_controls/useSlotProgramOptions.ts';
import type { CommonShowSlotViewModel } from '../../model/CommonSlotModels.ts';
import { CustomShowSlotProgrammingForm } from './CustomShowSlotProgrammingForm.tsx';
import { FillerListSlotProgrammingForm } from './FillerListSlotProgrammingForm.tsx';
import { RedirectProgrammingForm } from './RedirectProgrammingForm.tsx';
import { ShowSearchSlotProgrammingForm } from './ShowSearchSlotProgrammingForm.tsx';
import { SlotOrderFormControl } from './SlotOrderFormControl.tsx';
import { SmartCollectionSlotProgrammingForm } from './SmartCollectionSlotProgrammingForm.tsx';

type EditSlotProgramProps<SlotT extends { type: ProgramOptionType }> = {
  newSlotForType: (type: ProgramOptionType) => SlotT;
};

export const EditSlotProgrammingForm = ({
  newSlotForType,
}: EditSlotProgramProps<CommonShowSlotViewModel>) => {
  const { watch, reset, control, setValue } =
    useFormContext<CommonShowSlotViewModel>();
  const [type, show, seasonFilter] = watch(['type', 'show', 'seasonFilter']);
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

  const showIdController = useController({ control: control, name: 'showId' });

  const onShowChange = useCallback(
    (show: Show) => {
      showIdController.field.onChange(show.uuid);
      setValue('show', show);
      setValue('seasonFilter', []);
    },
    [setValue, showIdController.field],
  );

  const onSeasonFilterChange = useCallback(
    (seasonFilter: Season[]) => {
      setValue(
        'seasonFilter',
        seasonFilter.map((s) => s.index),
      );
    },
    [setValue],
  );

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
      {typeSelectValue === 'show' && (
        <>
          <ShowSearchSlotProgrammingForm
            show={show}
            seasonFilter={seasonFilter}
            onSeasonFilterChange={onSeasonFilterChange}
            onShowChange={onShowChange}
          />
          <SlotOrderFormControl />
        </>
      )}
      {typeSelectValue === 'redirect' && <RedirectProgrammingForm />}
      {typeSelectValue === 'movie' && <SlotOrderFormControl />}
    </>
  );
};
