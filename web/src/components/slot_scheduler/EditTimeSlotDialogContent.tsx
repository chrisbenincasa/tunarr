import type {
  CustomShowProgramOption,
  FillerProgramOption,
  ProgramOption,
} from '@/helpers/slotSchedulerUtil';
import { OneDayMillis } from '@/helpers/slotSchedulerUtil';
import {
  Box,
  Button,
  DialogActions,
  DialogContent,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
} from '@mui/material';
import { TimePicker } from '@mui/x-date-pickers';
import type { TimeSlot } from '@tunarr/types/api';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { find, isNil, map } from 'lodash-es';
import { useCallback, useState } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import type { StrictOmit } from 'ts-essentials';
import { match } from 'ts-pattern';
import { useFillerLists } from '../../hooks/useFillerLists.ts';
import { useTimeSlotFormContext } from '../../hooks/useTimeSlotFormContext.ts';
import type { UITimeSlot } from '../../pages/channels/TimeSlotEditorPage.tsx';
import { TabPanel } from '../TabPanel.tsx';
import { EditSlotProgrammingForm } from './EditSlotProgrammingForm.tsx';
import { SlotFillerDialogPanel } from './SlotFillerDialogPanel.tsx';

const DaysOfWeekMenuItems = [
  { value: 0, name: 'Sunday' },
  { value: 1, name: 'Monday' },
  { value: 2, name: 'Tuesday' },
  { value: 3, name: 'Wednesday' },
  { value: 4, name: 'Thursday' },
  { value: 5, name: 'Friday' },
  { value: 6, name: 'Saturday' },
];

type EditTimeSlotDialogContentProps = {
  slot: TimeSlot;
  index: number;
  programOptions: ProgramOption[];
  onClose: () => void;
};

type PartialTimeSlot = StrictOmit<UITimeSlot, 'startTime'>;

export const EditTimeSlotDialogContent = ({
  slot,
  index,
  programOptions,
  onClose,
}: EditTimeSlotDialogContentProps) => {
  const { getValues: getSlotFormValues, slotArray } = useTimeSlotFormContext();
  const currentPeriod = getSlotFormValues('period');
  const { data: fillerLists } = useFillerLists();

  const formMethods = useForm<UITimeSlot>({
    defaultValues: slot,
    reValidateMode: 'onChange',
  });

  const {
    control,
    getValues,
    formState: { isValid, isSubmitting },
  } = formMethods;

  const updateSlotDay = useCallback(
    (newDayOfWeek: number, originalOnChange: (...args: unknown[]) => void) => {
      const startTimeOfDay = getValues('startTime') % OneDayMillis;
      const newStartTime = startTimeOfDay + newDayOfWeek * OneDayMillis;
      originalOnChange(newStartTime);
    },
    [getValues],
  );

  const updateSlotTime = useCallback(
    (
      fieldValue: Dayjs | null,
      originalOnChange: (...args: unknown[]) => void,
    ) => {
      if (!fieldValue) return;
      const h = fieldValue.hour();
      const m = fieldValue.minute();
      const multiplier = Math.floor(getValues('startTime') / OneDayMillis);
      const millis = dayjs.duration({ hours: h, minutes: m }).asMilliseconds();
      originalOnChange(millis + multiplier * OneDayMillis);
    },
    [getValues],
  );

  const slotType = formMethods.watch('type');
  const [tab, setTab] = useState(0);

  const newSlotForType = useCallback(
    (type: TimeSlot['type']) => {
      const opt = find(
        programOptions,
        (opt): opt is CustomShowProgramOption => opt.type === 'custom-show',
      );
      return match(type)
        .returnType<PartialTimeSlot>()
        .with('custom-show', () => {
          return {
            type: 'custom-show',
            order: 'next',
            direction: 'asc',
            customShowId: opt!.customShowId,
            title: opt!.description,
          };
        })
        .with('movie', () => ({
          type: 'movie',
          order: 'alphanumeric',
          direction: 'asc',
          title: 'Movies',
        }))
        .with('filler', () => {
          const opt = programOptions.find(
            (opt): opt is FillerProgramOption => opt.type === 'filler',
          );
          return {
            type: 'filler',
            order: 'shuffle_prefer_short',
            decayFactor: 0.5,
            durationWeighting: 'linear',
            recoveryFactor: 0.05,
            fillerListId: opt!.fillerListId,
            title: opt!.description,
          };
        })
        .with('flex', () => ({
          type: 'flex',
          order: 'next',
          direction: 'asc',
          title: 'Flex',
        }))
        .with('redirect', () => {
          const opt = programOptions.find((opt) => opt.type === 'redirect');
          return {
            type: 'redirect',
            channelId: opt!.channelId,
            order: 'next',
            direction: 'asc',
            title: `Redirect to Channel ${opt!.channelName}`,
          };
        })
        .with('show', () => {
          const opt = programOptions.find((opt) => opt.type === 'show');
          return {
            type: 'show' as const,
            showId: opt?.showId ?? '',
            order: 'next',
            direction: 'asc',
            title: opt?.description ?? '',
          };
        })
        .exhaustive();
    },
    [programOptions],
  );

  const commit = () => {
    slotArray.update(index, getValues());
    onClose();
  };

  return (
    <>
      <DialogContent>
        <Box
          sx={{
            // pt: 2,
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
              disabled={slotType === 'flex' || fillerLists.length === 0}
            />
          </Tabs>
          <TabPanel value={tab} index={0}>
            <Stack gap={2} useFlexGap>
              <Stack direction="row" gap={1}>
                {currentPeriod === 'week' && (
                  <FormControl fullWidth>
                    <InputLabel>Day</InputLabel>
                    <Controller
                      control={control}
                      name={`startTime`}
                      render={({ field }) => (
                        <Select
                          {...field}
                          fullWidth
                          value={Math.floor(field.value / OneDayMillis)}
                          label="Day"
                          onChange={(e) =>
                            updateSlotDay(
                              e.target.value as number,
                              field.onChange,
                            )
                          }
                        >
                          {map(DaysOfWeekMenuItems, ({ value, name }) => (
                            <MenuItem key={value} value={value}>
                              {name}
                            </MenuItem>
                          ))}
                        </Select>
                      )}
                    />
                  </FormControl>
                )}
                <Controller
                  control={control}
                  name={`startTime`}
                  render={({ field, fieldState: { error } }) => {
                    return (
                      <TimePicker
                        disabled
                        reduceAnimations
                        {...field}
                        value={dayjs().startOf(currentPeriod).add(field.value)}
                        onChange={(value) =>
                          updateSlotTime(value, field.onChange)
                        }
                        label="Start Time"
                        closeOnSelect={false}
                        slotProps={{
                          textField: {
                            error: !isNil(error),
                          },
                        }}
                      />
                    );
                  }}
                />
              </Stack>
              <FormProvider {...formMethods}>
                <EditSlotProgrammingForm
                  programOptions={programOptions}
                  newSlotForType={newSlotForType}
                />
              </FormProvider>
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
        <Button
          disabled={!isValid || isSubmitting}
          onClick={() => commit()}
          variant="contained"
        >
          Save
        </Button>
      </DialogActions>
    </>
  );
};
