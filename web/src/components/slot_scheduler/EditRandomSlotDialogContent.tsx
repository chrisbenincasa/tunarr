import { NumericFormControllerText } from '@/components/util/TypedController.tsx';
import { betterHumanize } from '@/helpers/dayjs.ts';
import type {
  CustomShowProgramOption,
  FillerProgramOption,
} from '@/helpers/slotSchedulerUtil';
import { useAdjustRandomSlotWeights } from '@/hooks/slot_scheduler/useAdjustRandomSlotWeights.ts';
import { useRandomSlotFormContext } from '@/hooks/useRandomSlotFormContext.ts';
import {
  Alert,
  Box,
  Button,
  DialogActions,
  DialogContent,
  Slider,
  Stack,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { TimeField } from '@mui/x-date-pickers';
import type { RandomSlot } from '@tunarr/types/api';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { find, isNil, map } from 'lodash-es';
import React, { useCallback, useState } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import type { StrictOmit } from 'ts-essentials';
import { match } from 'ts-pattern';
import { useSlotProgramOptionsContext } from '../../hooks/programming_controls/useSlotProgramOptions.ts';
import { useFillerLists } from '../../hooks/useFillerLists.ts';
import type { SlotViewModel } from '../../model/SlotModels.ts';
import { RouterLink } from '../base/RouterLink.tsx';
import { TabPanel } from '../TabPanel.tsx';
import { EditSlotProgrammingForm } from './EditSlotProgrammingForm.tsx';
import { SlotFillerDialogPanel } from './SlotFillerDialogPanel.tsx';

type EditRandomSlotDialogContentProps = {
  slot: SlotViewModel;
  index: number;
  onSave: () => void;
  onCancel: () => void;
};

// Just the fields required for content
type PartialRandomSlot = StrictOmit<
  RandomSlot,
  'durationSpec' | 'cooldownMs' | 'weight'
>;

export const EditRandomSlotDialogContent = ({
  slot,
  index,
  onSave,
  onCancel,
}: EditRandomSlotDialogContentProps) => {
  const randomSlotForm = useRandomSlotFormContext();
  const programOptions = useSlotProgramOptionsContext();
  const { slotArray } = randomSlotForm;
  const [currentSlots, distribution, lockWeights] = randomSlotForm.watch([
    'slots',
    'randomDistribution',
    'lockWeights',
  ]);

  const formMethods = useForm<SlotViewModel>({
    defaultValues: slot,
    reValidateMode: 'onChange',
  });

  const { control, getValues, setValue, watch, formState } = formMethods;
  const { isValid, isDirty } = formState;
  const [durationSpec, programType] = watch(['durationSpec', 'type']);
  const [tab, setTab] = useState(0);
  const { data: fillerLists } = useFillerLists();

  const [weightValue, setWeightValue] = useState(getValues('weight'));

  const handleWeightChange = (_: Event, newValue: number | number[]) => {
    setWeightValue(newValue as number);
  };

  const adjustSlotWeights = useAdjustRandomSlotWeights();

  const setFormWeightValue = (
    _: React.SyntheticEvent | Event,
    newValue: number,
  ) => {
    if (!lockWeights) {
      setValue('weight', newValue, { shouldDirty: true, shouldTouch: true });
      randomSlotForm.setValue(
        'slots',
        currentSlots.map((slot, slotIdx) =>
          slotIdx === index ? { ...slot, weight: newValue } : slot,
        ),
        {
          shouldDirty: true,
          shouldTouch: true,
        },
      );
      return;
    }

    const newWeights = adjustSlotWeights(
      currentSlots.map((slot) => slot.weight),
      index,
      newValue,
      1,
    );

    if (newWeights) {
      setValue('weight', newWeights[index], {
        shouldDirty: true,
        shouldTouch: true,
      });

      randomSlotForm.setValue(
        'slots',
        map(currentSlots, (slot, idx) => ({
          ...slot,
          weight: newWeights[idx],
        })),
        {
          shouldDirty: true,
          shouldTouch: true,
        },
      );
    }
  };

  const commit = () => {
    slotArray.update(index, getValues());
    onSave();
  };

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

  const newSlotForType = useCallback(
    (type: RandomSlot['type']) => {
      return match(type)
        .returnType<PartialRandomSlot>()
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
          direction: 'asc',
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
        .with('smart-collection', () => {
          const opt = programOptions.find(
            (opt) => opt.type === 'smart-collection',
          );
          return {
            type: 'smart-collection' as const,
            order: 'next',
            direction: 'asc',
            smartCollectionId: opt?.collectionId ?? '',
          };
        })
        .exhaustive();
    },
    [programOptions],
  );

  // const slotId = getRandomSlotId(programming);
  // const programDetails = useScheduledSlotProgramDetails([slotId]);
  // TODO: Hook this up to a waring icon on the duration input
  // to show that the slot is not large enough for the scheduled programs
  // const overTimeCount = useMemo(() => {
  //   if (programDetails[slotId]) {
  //     return countWhere(
  //       programDetails[slotId]?.programDurations,
  //       ({ duration }) => duration > slotDuration,
  //     );
  //   }
  //   return 0;
  // }, [programDetails, slotDuration, slotId]);

  const handleDurationTypeChange = useCallback(
    (value: RandomSlot['durationSpec']['type']) => {
      if (value === 'fixed') {
        setValue(
          'durationSpec',
          {
            durationMs: dayjs.duration({ minutes: 30 }).asMilliseconds(),
            type: 'fixed',
          },
          {
            shouldDirty: true,
          },
        );
      } else {
        setValue(
          'durationSpec',
          {
            type: 'dynamic',
            programCount: 1,
          },
          { shouldDirty: true },
        );
      }
    },
    [setValue],
  );

  return (
    <>
      <DialogContent>
        <Box
          sx={{
            pt: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <Tabs
            value={tab}
            onChange={(_, tab: number) => setTab(tab)}
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="Programming" value={0} />
            {programType !== 'flex' && <Tab label="Filler" value={1} />}
          </Tabs>
          <TabPanel value={tab} index={0}>
            <Stack gap={2} useFlexGap>
              <Stack direction="row" gap={1}>
                {programType === 'flex' || programType === 'redirect' ? null : (
                  <Box>
                    <Controller
                      control={control}
                      name="durationSpec.type"
                      render={({ field }) => (
                        <ToggleButtonGroup
                          color="primary"
                          exclusive
                          aria-label="Platform"
                          {...field}
                          onChange={(_, value) =>
                            handleDurationTypeChange(
                              value as RandomSlot['durationSpec']['type'],
                            )
                          }
                        >
                          <ToggleButton value="fixed">Fixed</ToggleButton>
                          <ToggleButton value="dynamic">Dynamic</ToggleButton>
                        </ToggleButtonGroup>
                      )}
                    />
                  </Box>
                )}
                {durationSpec.type === 'dynamic' && (
                  <NumericFormControllerText
                    control={control}
                    TextFieldProps={{
                      label: 'Program Count',
                      fullWidth: true,
                      helperText: '',
                    }}
                    rules={{
                      min: durationSpec.type === 'dynamic' ? 1 : undefined,
                    }}
                    defaultValue={1}
                    name="durationSpec.programCount"
                  />
                )}
                {durationSpec.type === 'fixed' && (
                  <Controller
                    control={control}
                    name="durationSpec.durationMs"
                    rules={{
                      min: durationSpec.type === 'fixed' ? 1 : undefined,
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
                                { exact: true, style: 'full' },
                              ),
                            },
                          }}
                        />
                      );
                    }}
                  />
                )}
                {distribution !== 'none' && (
                  <Controller
                    control={control}
                    name="cooldownMs"
                    render={({ field, fieldState: { error } }) => {
                      return (
                        <TimeField
                          format="H[h] m[m] s[s]"
                          {...field}
                          value={dayjs().startOf('day').add(field.value)}
                          onChange={(value) =>
                            updateSlotTime(value, field.onChange)
                          }
                          label="Cooldown"
                          slotProps={{
                            textField: {
                              fullWidth: true,
                              error: !isNil(error),
                              helperText: betterHumanize(
                                dayjs.duration(field.value),
                                { exact: true, style: 'full' },
                              ),
                            },
                          }}
                        />
                      );
                    }}
                  />
                )}
              </Stack>
              <FormProvider {...formMethods}>
                <EditSlotProgrammingForm newSlotForType={newSlotForType} />
              </FormProvider>
              {distribution === 'weighted' && (
                <Stack direction="row" spacing={2} alignItems="center">
                  <Slider
                    min={0}
                    max={100}
                    value={weightValue}
                    step={0.1}
                    onChange={handleWeightChange}
                    onChangeCommitted={setFormWeightValue}
                    sx={{
                      width: '90%',
                      '& .MuiSlider-thumb': {
                        transition: 'left 0.1s',
                      },
                      '& .MuiSlider-thumb.MuiSlider-active': {
                        transition: 'left 0s',
                      },
                      '& .MuiSlider-track': {
                        transition: 'width 0.1s',
                      },
                    }}
                  />
                  <TextField
                    type="number"
                    label={lockWeights ? 'Weight %' : 'Frequency'}
                    value={weightValue}
                    disabled
                  />
                </Stack>
              )}
            </Stack>
          </TabPanel>
          <TabPanel value={tab} index={1}>
            {fillerLists.length === 0 ? (
              <Alert severity="warning" variant="outlined">
                You must create at least one{' '}
                <RouterLink to="/library/fillers">filler list</RouterLink>{' '}
                before assigning filler to a lot.
              </Alert>
            ) : (
              <FormProvider {...formMethods}>
                <SlotFillerDialogPanel />
              </FormProvider>
            )}
          </TabPanel>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onCancel()}>Cancel</Button>
        <Button
          disabled={!isDirty || !isValid}
          onClick={() => commit()}
          variant="contained"
        >
          Save
        </Button>
      </DialogActions>
    </>
  );
};
