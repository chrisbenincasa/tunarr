import type {
  ProgramOption,
  RedirectProgramOption,
} from '@/helpers/slotSchedulerUtil';
import { ProgramOptionTypes } from '@/helpers/slotSchedulerUtil.ts';
import {
  Autocomplete,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from '@mui/material';
import type { BaseSlot } from '@tunarr/types/api';
import { filter, find, first, map, uniqBy } from 'lodash-es';
import { useMemo, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { CustomShowSlotProgrammingForm } from './CustomShowSlotProgrammingForm.tsx';
import { FillerListSlotProgrammingForm } from './FillerListSlotProgrammingForm.tsx';
import { ShowSearchSlotProgrammingForm } from './ShowSearchSlotProgrammingForm.tsx';
import { ShowSlotProgrammingForm } from './ShowSlotProgrammingForm.tsx';
import { SlotOrderFormControl } from './SlotOrderFormControl.tsx';

type EditSlotProgramProps<SlotType extends BaseSlot> = {
  programOptions: ProgramOption[];
  newSlotForType: (type: SlotType['type']) => SlotType;
};

export const EditSlotProgrammingForm = <SlotType extends BaseSlot>({
  programOptions,
  newSlotForType,
}: EditSlotProgramProps<SlotType>) => {
  const { watch, control, reset } = useFormContext<BaseSlot>();
  const type = watch('type');
  const availableTypes = useMemo(() => {
    return map(
      uniqBy(programOptions, ({ type }) => type),
      'type',
    );
  }, [programOptions]);
  const [typeSelectValue, setTypeSelectValue] =
    useState<ProgramOption['type']>(type);
  // console.log(availableTypes, programOptions);

  const handleTypeChange = (value: ProgramOption['type']) => {
    if (value === typeSelectValue) {
      return;
    }

    setTypeSelectValue(value);

    let slot: SlotType;
    switch (value) {
      case 'movie':
      case 'flex':
      case 'custom-show':
      case 'redirect':
      case 'show':
      case 'filler':
        slot = newSlotForType(value);
        break;
      case 'show-search':
        slot = newSlotForType('show');
        break;
    }

    reset((prev) => ({ ...prev, ...slot }));
  };

  const redirectShowAutoCompleteOpts = useMemo(
    () =>
      type === 'redirect'
        ? map(
            filter(
              programOptions,
              (opt): opt is RedirectProgramOption => opt.type === 'redirect',
            ),
            (opt) => ({
              ...opt,
              label: opt.channelName,
            }),
          )
        : [],
    [programOptions, type],
  );

  return (
    <>
      <FormControl fullWidth>
        <InputLabel>Type</InputLabel>
        {/* <Controller
          control={control}
          name="type"
          render={({ field }) => (
            
          )}
        /> */}
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
      {typeSelectValue === 'custom-show' && (
        <CustomShowSlotProgrammingForm programOptions={programOptions} />
      )}
      {typeSelectValue === 'filler' && (
        <FillerListSlotProgrammingForm programOptions={programOptions} />
      )}
      {typeSelectValue === 'show' && (
        <ShowSlotProgrammingForm programOptions={programOptions} />
      )}
      {typeSelectValue === 'show-search' && <ShowSearchSlotProgrammingForm />}
      {typeSelectValue === 'redirect' && (
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
              renderInput={(params) => (
                <TextField {...params} label="Program" />
              )}
            />
          )}
        />
      )}
      {typeSelectValue === 'movie' && <SlotOrderFormControl />}
    </>
  );
};
