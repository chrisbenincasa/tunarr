import { OneDayMillis, ProgramOption } from '@/helpers/slotSchedulerUtil';
import { showOrderOptions } from '@/helpers/slotSchedulerUtil.ts';
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
import { TimeSlot } from '@tunarr/types/api';
import dayjs, { Dayjs } from 'dayjs';
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

type EditSlotDialogContentProps = {
  slot: TimeSlot;
  index: number;
  programOptions: ProgramOption[];
  onClose: () => void;
};

export const EditSlotDialogContent = ({
  slot,
  index,
  programOptions,
  onClose,
}: EditSlotDialogContentProps) => {
  const { getValues: getSlotFormValues, slotArray } = useTimeSlotFormContext();
  const currentPeriod = getSlotFormValues('period');

  const formMethods = useForm({
    defaultValues: slot,
  });
  const { control, watch, getValues } = formMethods;

  const slotType = watch(`programming.type`);
  const isShowType = slotType === 'custom-show' || slotType === 'show';
  const updateSlotDay = useCallback(
    (newDayOfWeek: number, originalOnChange: (...args: unknown[]) => void) => {
      const startTimeOfDay = slot.startTime % OneDayMillis;
      const newStartTime = startTimeOfDay + newDayOfWeek * OneDayMillis;
      originalOnChange(newStartTime);
    },
    [slot.startTime],
  );

  const updateSlotTime = useCallback(
    (fieldValue: Dayjs, originalOnChange: (...args: unknown[]) => void) => {
      const h = fieldValue.hour();
      const m = fieldValue.minute();
      const millis = dayjs.duration({ hours: h, minutes: m }).asMilliseconds();
      originalOnChange(millis);
    },
    [],
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
                      onChange={(value) => {
                        value ? updateSlotTime(value, field.onChange) : void 0;
                      }}
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
            {isShowType && (
              <FormControl fullWidth>
                <InputLabel>Order</InputLabel>
                <Controller
                  control={control}
                  name="order"
                  render={({ field }) => (
                    <Select label="Order" {...field}>
                      {map(showOrderOptions, ({ description, value }) => (
                        <MenuItem key={value} value={value}>
                          {description}
                        </MenuItem>
                      ))}
                    </Select>
                  )}
                />
              </FormControl>
            )}
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
