import type {
  CustomShowProgramOption,
  FillerProgramOption,
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
import { useCallback, useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { match } from 'ts-pattern';
import { CustomShowSlotProgrammingForm } from './CustomShowSlotProgrammingForm.tsx';
import { FillerListSlotProgrammingForm } from './FillerListSlotProgrammingForm.tsx';
import { ShowSlotProgrammingForm } from './ShowSlotProgrammingForm.tsx';
import { SlotOrderFormControl } from './SlotOrderFormControl.tsx';

type EditSlotProgramProps = {
  programOptions: ProgramOption[];
};

export const EditSlotProgrammingForm = ({
  programOptions,
}: EditSlotProgramProps) => {
  const { watch, control, reset } = useFormContext<BaseSlot>();
  const [type] = watch(['type']);
  const availableTypes = useMemo(() => {
    return map(
      uniqBy(programOptions, ({ type }) => type),
      'type',
    );
  }, [programOptions]);

  const newSlotForType = useCallback(
    (type: BaseSlot['type']) => {
      return match(type)
        .returnType<BaseSlot>()
        .with('custom-show', () => ({
          type: 'custom-show',
          order: 'next',
          direction: 'asc',
          customShowId: find(
            programOptions,
            (opt): opt is CustomShowProgramOption => opt.type === 'custom-show',
          )!.customShowId,
        }))
        .with('movie', () => ({
          type: 'movie',
          order: 'alphanumeric',
          direction: 'asc',
        }))
        .with('filler', () => ({
          type: 'filler',
          order: 'shuffle_prefer_short',
          decayFactor: 0.5,
          durationWeighting: 'linear',
          recoveryFactor: 0.05,
          fillerListId: programOptions.find(
            (opt): opt is FillerProgramOption => opt.type === 'filler',
          )!.fillerListId,
        }))
        .with('flex', () => ({ type: 'flex', order: 'next', direction: 'asc' }))
        .with('redirect', () => ({
          type: 'redirect',
          channelId: programOptions.find((opt) => opt.type === 'redirect')!
            .channelId,
          order: 'next',
          direction: 'asc',
        }))
        .with('show', () => ({
          type: 'show',
          showId: programOptions.find((opt) => opt.type === 'show')!.showId,
          order: 'next',
          direction: 'asc',
        }))
        .exhaustive();
    },
    [programOptions],
  );

  const handleTypeChange = (value: BaseSlot['type']) => {
    if (value === type) {
      return;
    }

    reset(newSlotForType(value), {
      keepDefaultValues: true,
      keepDirty: true,
    });
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
        <Controller
          control={control}
          name="type"
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
        <CustomShowSlotProgrammingForm programOptions={programOptions} />
      )}
      {type === 'filler' && (
        <FillerListSlotProgrammingForm programOptions={programOptions} />
      )}
      {type === 'show' && (
        <ShowSlotProgrammingForm programOptions={programOptions} />
      )}
      {type === 'redirect' && (
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
      {type === 'movie' && <SlotOrderFormControl />}
    </>
  );
};
