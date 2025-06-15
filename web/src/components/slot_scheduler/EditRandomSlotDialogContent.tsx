import { NumericFormControllerText } from '@/components/util/TypedController.tsx';
import { betterHumanize } from '@/helpers/dayjs.ts';
import type { ProgramOption } from '@/helpers/slotSchedulerUtil';
import { useAdjustRandomSlotWeights } from '@/hooks/slot_scheduler/useAdjustRandomSlotWeights.ts';
import { useRandomSlotFormContext } from '@/hooks/useRandomSlotFormContext.ts';
import {
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
import { isNil, map } from 'lodash-es';
import React, { useCallback, useState } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { useFillerLists } from '../../hooks/useFillerLists.ts';
import { TabPanel } from '../TabPanel.tsx';
import { EditSlotProgrammingForm } from './EditSlotProgrammingForm.tsx';
import { SlotFillerDialogPanel } from './SlotFillerDialogPanel.tsx';

type EditRandomSlotDialogContentProps = {
  slot: RandomSlot;
  index: number;
  programOptions: ProgramOption[];
  onClose: () => void;
};

export const EditRandomSlotDialogContent = ({
  slot,
  index,
  programOptions,
  onClose,
}: EditRandomSlotDialogContentProps) => {
  const randomSlotForm = useRandomSlotFormContext();
  const { slotArray } = randomSlotForm;
  const [currentSlots, distribution] = randomSlotForm.watch([
    'slots',
    'randomDistribution',
  ]);

  const formMethods = useForm<RandomSlot>({
    defaultValues: slot,
  });
  const { control, getValues, setValue, watch } = formMethods;
  const [durationSpec, programType] = watch(['durationSpec', 'type']);
  const [tab, setTab] = useState(0);
  const { data: fillerLists } = useFillerLists();

  // const [programming, slotDuration] = watch([`programming`, 'durationMs']);
  const [weightValue, setWeightValue] = useState(getValues('weight'));

  const handleWeightChange = (_: Event, newValue: number | number[]) => {
    setWeightValue(newValue as number);
  };

  const adjustSlotWeights = useAdjustRandomSlotWeights();

  const setFormWeightValue = (
    _: React.SyntheticEvent | Event,
    newValue: number | number[],
  ) => {
    const newWeights = adjustSlotWeights(index, newValue as number, 1);
    if (newWeights) {
      setValue('weight', newWeights[index]);
      randomSlotForm.setValue(
        'slots',
        map(currentSlots, (slot, idx) => ({
          ...slot,
          weight: newWeights[idx],
        })),
      );
    }
  };

  const commit = () => {
    slotArray.update(index, getValues());
    onClose();
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
            <Tab label="Programming" />
            <Tab
              label="Filler"
              disabled={programType === 'flex' || fillerLists.length === 0}
            />
          </Tabs>
          <TabPanel value={tab} index={0}>
            <Stack gap={2} useFlexGap>
              <Stack direction="row" gap={1}>
                {(programType === 'custom-show' ||
                  programType === 'movie' ||
                  programType === 'show' ||
                  programType === 'filler') && (
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
                      min: 1,
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
                      min: 1,
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
                <EditSlotProgrammingForm programOptions={programOptions} />
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
                    label="Weight %"
                    value={weightValue}
                    disabled
                  />
                </Stack>
              )}
            </Stack>
          </TabPanel>
          <TabPanel value={tab} index={1}>
            <FormProvider {...formMethods}>
              <SlotFillerDialogPanel />
            </FormProvider>
          </TabPanel>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()}>Cancel</Button>
        <Button onClick={() => commit()} variant="contained">
          Save
        </Button>
      </DialogActions>
    </>
  );
};
