import {
  CustomShowProgramOption,
  ProgramOption,
  RedirectProgramOption,
  ShowProgramOption,
  slotOrderOptions,
} from '@/helpers/slotSchedulerUtil';
import { ProgramOptionTypes } from '@/helpers/slotSchedulerUtil.ts';
import {
  Autocomplete,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  BaseSlot,
  CustomShowProgrammingTimeSlot,
  FlexProgrammingTimeSlot,
  MovieProgrammingTimeSlot,
  RedirectProgrammingTimeSlot,
  ShowProgrammingTimeSlot,
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
  const { setValue, watch, control } = useFormContext<BaseSlot>();
  const { type } = watch('programming');
  const availableTypes = useMemo(() => {
    return map(
      uniqBy(programOptions, ({ type }) => type),
      'type',
    );
  }, [programOptions]);

  const handleTypeChange = (value: ProgramOption['type']) => {
    if (value === type) {
      return;
    }

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
    setValue(`programming`, newSlot, { shouldDirty: true, shouldTouch: true });
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

  const handleDirectionChange = (
    newDirection: string | null,
    originalOnChange: (...args: unknown[]) => void,
  ) => {
    if (newDirection) {
      originalOnChange(newDirection);
    }
  };

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
      {type === 'redirect' && (
        <Controller
          control={control}
          name="programming.channelId"
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
      {(type === 'show' || type === 'custom-show' || type === 'movie') && (
        <Stack direction="row" spacing={2}>
          <FormControl fullWidth>
            <InputLabel>Order</InputLabel>
            <Controller
              control={control}
              name="order"
              render={({ field }) => (
                <Select label="Order" {...field}>
                  {map(slotOrderOptions(type), ({ description, value }) => (
                    <MenuItem key={value} value={value}>
                      {description}
                    </MenuItem>
                  ))}
                </Select>
              )}
            />
          </FormControl>
          <Controller
            control={control}
            name="direction"
            render={({ field }) => (
              <ToggleButtonGroup
                exclusive
                value={field.value}
                onChange={(_, value) =>
                  handleDirectionChange(value as string | null, field.onChange)
                }
              >
                <ToggleButton value="asc">Asc</ToggleButton>
                <ToggleButton value="desc">Desc</ToggleButton>
              </ToggleButtonGroup>
            )}
          />
        </Stack>
      )}
    </>
  );
};
