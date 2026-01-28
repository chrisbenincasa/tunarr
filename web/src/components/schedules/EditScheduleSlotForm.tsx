import {
  Box,
  Button,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { TimeField, TimePicker } from '@mui/x-date-pickers';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isNonEmptyString } from '@tunarr/shared/util';
import type { Season, Show, TupleToUnion } from '@tunarr/types';
import type { MaterializedShowScheduleSlot } from '@tunarr/types/api';
import {
  FillModes,
  type MaterializedCustomShowScheduleSlot,
  type MaterializedScheduleSlot,
  type Schedule,
  type ScheduleSlot,
} from '@tunarr/types/api';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { capitalize, find, isNil, maxBy } from 'lodash-es';
import { useCallback, useState } from 'react';
import type { SubmitErrorHandler, SubmitHandler } from 'react-hook-form';
import {
  Controller,
  FormProvider,
  useController,
  useForm,
} from 'react-hook-form';
import { match } from 'ts-pattern';
import {
  addSlotToScheduleMutation,
  getScheduleByIdQueryKey,
} from '../../generated/@tanstack/react-query.gen.ts';
import { betterHumanize } from '../../helpers/dayjs.ts';
import type { ProgramOption } from '../../helpers/slotSchedulerUtil.ts';
import {
  ProgramOptionTypes,
  slotOrderOptions,
} from '../../helpers/slotSchedulerUtil.ts';
import { ShowSearchSlotProgrammingForm } from '../slot_scheduler/ShowSearchSlotProgrammingForm.tsx';
import { NumericFormControllerText } from '../util/TypedController.tsx';

type Props = {
  schedule: Schedule;
  slot: MaterializedScheduleSlot;
};

function defaultCustomShowSlot(
  schedule: Schedule,
): MaterializedCustomShowScheduleSlot {
  return {
    type: 'custom-show',
    // order: 'next',
    // direction: 'asc',
    customShowId: '', // opt!.customShowId,
    cooldownMs: 0,
    slotIndex:
      (maxBy(schedule.slots, (slot) => slot.slotIndex)?.slotIndex ?? -1) + 1,
    weight: 0,
    customShow: null,
    isMissing: false,
    fillMode: 'fill',
    fillValue: 0,
  };
}

const newSlotForType = (
  type: MaterializedScheduleSlot['type'],
  schedule: Schedule,
) => {
  // const startTime = getValues('startTime');
  // const opt = find(
  //   programOptions,
  //   (opt): opt is CustomShowProgramOption => opt.type === 'custom-show',
  // );
  return (
    match(type)
      .returnType<MaterializedScheduleSlot>()
      .with('custom-show', () => defaultCustomShowSlot(schedule))
      // .with('movie', () => ({
      //   type: 'movie',
      //   order: 'alphanumeric',
      //   direction: 'asc',
      //   title: 'Movies',
      // }))
      .with('filler', () => {
        return {
          type: 'filler',
          cooldownMs: 0,
          slotIndex: 0,
          weight: 0,
          // order: 'shuffle_prefer_short',
          // decayFactor: 0.5,
          // durationWeighting: 'linear',
          // recoveryFactor: 0.05,
          fillerListId: '',
          fillerList: null,
          isMissing: false,
        };
      })
      .with('flex', () => ({
        type: 'flex',
        cooldownMs: 0,
        slotIndex: 0,
        weight: 0,
      }))
      .with('redirect', () => {
        // const opt = programOptions.find((opt) => opt.type === 'redirect');
        return {
          cooldownMs: 0,
          slotIndex: 0,
          weight: 0,
          type: 'redirect',
          redirectChannelId: '', // opt?.channelId ?? '',
          order: 'next',
          direction: 'asc',
          title: '', // `Redirect to Channel ${opt?.channelName ?? ''}`,
          channel: null,
          isMissing: false,
        };
      })
      .with('show', () => {
        // const opt = programOptions.find((opt) => opt.type === 'show');
        return {
          cooldownMs: 0,
          slotIndex: 0,
          weight: 0,
          type: 'show' as const,
          showId: '', // opt?.showId ?? '',
          // order: 'next',
          // direction: 'asc',
          slotConfig: {
            order: 'next',
            direction: 'asc',
            seasonFilter: [],
          },
          show: null,
          fillMode: 'fill',
          fillValue: 0,
        } satisfies MaterializedShowScheduleSlot;
      })
      .with('smart-collection', () => {
        // const opt = programOptions.find(
        //   (opt) => opt.type === 'smart-collection',
        // );
        return {
          cooldownMs: 0,
          slotIndex: 0,
          weight: 0,
          type: 'smart-collection' as const,
          order: 'next',
          direction: 'asc',
          smartCollectionId: '', //opt?.collectionId ?? '',
          smartCollection: null,
          isMissing: false,
        };
      })
      .exhaustive()
  );
};

const StartType = ['anchored', 'dynamic'] as const;
type StartType = TupleToUnion<typeof StartType>;

export const EditScheduleSlotForm = ({ schedule, slot }: Props) => {
  const form = useForm<MaterializedScheduleSlot>({
    defaultValues: slot,
  });

  const {
    watch,
    setValue,
    reset,
    control,
    getValues,
    formState,
    handleSubmit,
  } = form;
  const { isDirty, isValid, isSubmitting } = formState;

  const [type, fillMode, show, slotConfig] = watch([
    'type',
    'fillMode',
    'show',
    'slotConfig',
  ]);
  const seasonFilter = slotConfig?.seasonFilter;
  const order = slotConfig?.order;
  const [typeSelectValue, setTypeSelectValue] = useState(type);
  const [startType, setStartType] = useState<StartType>('dynamic');

  const handleTypeChange = useCallback(
    (typ: ScheduleSlot['type']) => {
      const newSlot = newSlotForType(typ, schedule);
      setTypeSelectValue(typ);
      reset((prev) => ({ ...prev, ...newSlot }));
    },
    [reset, schedule],
  );

  const updateFillMode = useCallback(
    (fillType: FillMode, originalOnChange: (...args: unknown[]) => void) => {
      setValue('fillValue', 0);
      originalOnChange(fillType);
    },
    [setValue],
  );

  const updateSlotTime = useCallback(
    (
      fieldValue: Dayjs | null,
      originalOnChange: (...args: unknown[]) => void,
    ) => {
      if (!fieldValue) return;
      const h = fieldValue.hour();
      const m = fieldValue.minute();
      const millis = dayjs.duration({ hours: h, minutes: m }).asMilliseconds();
      originalOnChange(millis);
    },
    [],
  );

  const showIdController = useController({ control: control, name: 'showId' });

  const onShowChange = useCallback(
    (show: Show) => {
      showIdController.field.onChange(show.uuid);
      setValue('show', show);
      setValue('slotConfig.seasonFilter', []);
    },
    [setValue, showIdController.field],
  );

  const onSeasonFilterChange = useCallback(
    (seasonFilter: Season[]) => {
      setValue(
        'slotConfig.seasonFilter',
        seasonFilter.map((s) => s.index),
      );
    },
    [setValue],
  );

  const queryClient = useQueryClient();
  const addSlotMutation = useMutation({
    ...addSlotToScheduleMutation(),
    onSuccess: async (data) => {
      reset((prev) => ({ ...prev, ...data }));
      await queryClient.invalidateQueries({
        queryKey: getScheduleByIdQueryKey({ path: { id: schedule.uuid } }),
      });
    },
  });

  const onSubmit: SubmitHandler<MaterializedScheduleSlot> = useCallback(
    (values: MaterializedScheduleSlot) => {
      console.log(values);
      addSlotMutation.mutate({
        path: {
          id: schedule.uuid,
        },
        body: values,
      });
    },
    [addSlotMutation, schedule.uuid],
  );

  const onSubmitError: SubmitErrorHandler<MaterializedScheduleSlot> =
    useCallback((errors) => {
      console.error(errors);
    }, []);

  return (
    <Box component={'form'} onSubmit={handleSubmit(onSubmit, onSubmitError)}>
      <FormProvider {...form}>
        <Stack spacing={2}>
          <FormControl fullWidth>
            <InputLabel>Type</InputLabel>
            <Select
              label="Type"
              value={typeSelectValue}
              onChange={(e) =>
                handleTypeChange(e.target.value as ProgramOption['type'])
              }
            >
              {ProgramOptionTypes.map(({ value, description }) => (
                <MenuItem key={value} value={value}>
                  {description}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {type === 'show' && (
            <ShowSearchSlotProgrammingForm
              show={show}
              onShowChange={onShowChange}
              onSeasonFilterChange={onSeasonFilterChange}
              seasonFilter={seasonFilter ?? []}
            />
          )}
          <Stack direction="row" spacing={2}>
            <Controller
              control={control}
              name="slotConfig.order"
              render={({ field }) => {
                const opts = slotOrderOptions(type);
                const helperText = find(opts, {
                  value: field.value,
                })?.helperText;
                return (
                  <FormControl fullWidth>
                    <InputLabel>Order</InputLabel>
                    <Select label="Order" {...field}>
                      {opts.map(({ description, value }) => (
                        <MenuItem key={value} value={value}>
                          {description}
                        </MenuItem>
                      ))}
                    </Select>
                    <FormHelperText>
                      Choose how to sort the programs in this slot.
                      <br />
                      <Box component="ul" sx={{ pl: 1 }}>
                        <li>
                          <strong>Next:</strong> play in order depending on slot
                          type
                        </li>
                        <li>
                          <strong>Ordered Shuffle:</strong> like "Next" but with
                          a random start point
                        </li>
                      </Box>
                    </FormHelperText>
                    {helperText && (
                      <FormHelperText>{helperText}</FormHelperText>
                    )}
                  </FormControl>
                );
              }}
            />
            {(order === 'alphanumeric' ||
              order === 'chronological' ||
              order === 'ordered_shuffle') && (
              <Controller
                control={control}
                name="slotConfig.direction"
                render={({ field }) => (
                  <ToggleButtonGroup
                    exclusive
                    value={field.value}
                    onChange={(_, value) =>
                      isNonEmptyString(value) ? field.onChange(value) : void 0
                    }
                  >
                    <ToggleButton value="asc">Asc</ToggleButton>
                    <ToggleButton value="desc">Desc</ToggleButton>
                  </ToggleButtonGroup>
                )}
              />
            )}
          </Stack>
          <Stack direction={'row'} spacing={2}>
            <FormControl fullWidth>
              <InputLabel>Start Type</InputLabel>
              <Select
                label="Start Type"
                value={startType}
                onChange={(e) => setStartType(e.target.value as StartType)}
              >
                {StartType.map((type) => (
                  <MenuItem key={type} value={type}>
                    {capitalize(type)}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>
                <Box component="ul" sx={{ pl: 1 }}>
                  <li>
                    <strong>Dynamic:</strong> this slot begins when the
                    preceeding slot ends.
                  </li>
                  <li>
                    <strong>Anchored:</strong> begin this slot at a fixed time.
                  </li>
                </Box>
              </FormHelperText>
            </FormControl>
            {startType === 'anchored' && (
              <TimePicker
                slotProps={{ textField: { fullWidth: true, helperText: ' ' } }}
              />
            )}
          </Stack>
          <Stack direction={'row'} spacing={2}>
            <Controller
              control={control}
              name="fillMode"
              render={({ field }) => (
                <FormControl fullWidth>
                  <InputLabel>Fill Mode</InputLabel>
                  <Select
                    label="Fill Mode"
                    value={field.value}
                    onChange={(e) =>
                      updateFillMode(e.target.value as FillMode, field.onChange)
                    }
                  >
                    {FillModes.map((type) => (
                      <MenuItem key={type} value={type}>
                        {capitalize(type)}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>
                    <Box component="ul" sx={{ pl: 1 }}>
                      <li>
                        <strong>Fill:</strong> continuously pick programs from
                        this slot until the next time-anchored slot.
                      </li>
                      <li>
                        <strong>Count:</strong> pick N programs.
                      </li>
                      <li>
                        <strong>Duration:</strong> pick programs in order to
                        fill a specific time duration.
                      </li>
                    </Box>
                  </FormHelperText>
                </FormControl>
              )}
            />
            {fillMode === 'count' && (
              <NumericFormControllerText
                control={control}
                name="fillValue"
                rules={{ min: fillMode === 'count' ? 1 : undefined }}
                TextFieldProps={{
                  fullWidth: true,
                  label: 'Count',
                  helperText: ' ',
                }}
              />
            )}
            {fillMode === 'duration' && (
              <Controller
                control={control}
                name="fillValue"
                rules={{
                  min: fillMode === 'duration' ? 1 : undefined,
                }}
                render={({ field, fieldState: { error } }) => {
                  return (
                    <TimeField
                      format="H[h] m[m] s[s]"
                      {...field}
                      value={dayjs().startOf('day').add(field.value)}
                      onChange={(value) =>
                        updateSlotTime(value, field.onChange)
                      }
                      label="Duration"
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          error: !isNil(error),
                          helperText: betterHumanize(
                            dayjs.duration(field.value),
                            {
                              exact: true,
                              style: 'full',
                            },
                          ),
                        },
                      }}
                    />
                  );
                }}
              />
            )}
          </Stack>
          <Stack spacing={2} direction="row" justifyContent="right">
            {(isDirty || (isDirty && !isSubmitting)) && (
              <Button
                variant="outlined"
                onClick={() => {
                  reset();
                }}
              >
                Reset Changes
              </Button>
            )}
            <Button
              variant="contained"
              disabled={!isValid || isSubmitting || (!isDirty && !!schedule)}
              type="submit"
            >
              Save
            </Button>
          </Stack>
        </Stack>
      </FormProvider>
    </Box>
  );
};
