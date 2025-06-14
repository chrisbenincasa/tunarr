import type { ProgramOption } from '@/helpers/slotSchedulerUtil';
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
} from '@mui/material';
import { TimePicker } from '@mui/x-date-pickers';
import type { TimeSlot } from '@tunarr/types/api';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { isNil, map } from 'lodash-es';
import { useCallback } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { useTimeSlotFormContext } from '../../hooks/useTimeSlotFormContext.ts';
import { EditSlotProgrammingForm } from './EditSlotProgrammingForm.tsx';

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

export const EditTimeSlotDialogContent = ({
  slot,
  index,
  programOptions,
  onClose,
}: EditTimeSlotDialogContentProps) => {
  const { getValues: getSlotFormValues, slotArray } = useTimeSlotFormContext();
  const currentPeriod = getSlotFormValues('period');

  const formMethods = useForm<TimeSlot>({
    defaultValues: slot,
  });
  const { control, getValues } = formMethods;

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

  const commit = () => {
    slotArray.update(index, getValues());
    onClose();
  };

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
              <EditSlotProgrammingForm programOptions={programOptions} />
            </FormProvider>
          </Stack>
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
