import {
  CustomShowProgramOption,
  ProgramOption,
  RedirectProgramOption,
  ShowProgramOption,
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
import {
  CustomShowProgrammingTimeSlot,
  FlexProgrammingTimeSlot,
  MovieProgrammingTimeSlot,
  RedirectProgrammingTimeSlot,
  ShowProgrammingTimeSlot,
  TimeSlot,
  TimeSlotProgramming,
} from '@tunarr/types/api';
import { filter, find, first, map, uniqBy } from 'lodash-es';
import { useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

type EditSlotProgramProps = {
  programOptions: ProgramOption[];
};

export const EditSlotProgrammingForm = ({
  programOptions,
}: EditSlotProgramProps) => {
  const { setValue, watch, control } = useFormContext<TimeSlot>();
  const type = watch('programming.type');
  const availableTypes = useMemo(() => {
    return map(
      uniqBy(programOptions, ({ type }) => type),
      'type',
    );
  }, [programOptions]);

  const handleTypeChange = (value: ProgramOption['type']) => {
    let newSlot: TimeSlotProgramming;
    switch (value) {
      case 'movie':
        newSlot = {
          type: 'movie',
        } satisfies MovieProgrammingTimeSlot;
        break;
      case 'flex':
        newSlot = {
          type: 'flex',
        } satisfies FlexProgrammingTimeSlot;
        break;
      case 'custom-show':
        newSlot = {
          type: 'custom-show',
          customShowId: find(
            programOptions,
            (opt): opt is CustomShowProgramOption => opt.type === 'custom-show',
          )!.customShowId,
        } satisfies CustomShowProgrammingTimeSlot;
        break;
      case 'redirect':
        newSlot = {
          channelId: find(
            programOptions,
            (opt): opt is RedirectProgramOption => opt.type === 'redirect',
          )!.channelId,
          type: 'redirect',
        } satisfies RedirectProgrammingTimeSlot;
        break;
      case 'show':
        newSlot = {
          type: 'show',
          showId: find(
            programOptions,
            (opt): opt is ShowProgramOption => opt.type === 'show',
          )!.showId,
        } satisfies ShowProgrammingTimeSlot;
    }
    setValue(`programming`, newSlot, { shouldDirty: true });
  };

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
      <FormControl fullWidth>
        <InputLabel>Type</InputLabel>
        <Controller
          control={control}
          name="programming.type"
          render={({ field }) => (
            <Select
              label="Type"
              value={field.value}
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
          )}
        />
      </FormControl>
      {type === 'custom-show' && (
        <Controller
          control={control}
          name="programming.customShowId"
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
      )}
      {type === 'show' && (
        <Controller
          control={control}
          name="programming.showId"
          render={({ field }) => (
            <Autocomplete<ShowProgramOption & { label: string }>
              value={
                find(
                  showAutoCompleteOpts,
                  (opt) => opt.showId === field.value,
                ) ?? first(showAutoCompleteOpts)
              }
              options={showAutoCompleteOpts}
              onChange={(_, value) =>
                value ? field.onChange(value.showId) : void 0
              }
              renderInput={(params) => (
                <TextField {...params} label="Program" />
              )}
            />
          )}
        />
      )}
    </>
  );
};
