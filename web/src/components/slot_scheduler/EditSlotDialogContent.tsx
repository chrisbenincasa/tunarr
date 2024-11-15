import { ProgramOption } from '@/helpers/slotSchedulerUtil';
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
  const {
    control,
    watch,
    formState: { isValid, isDirty },
    getValues,
  } = formMethods;

  const slotType = watch(`programming.type`);
  const isShowType = slotType === 'custom-show' || slotType === 'show';

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
        <Button
          onClick={() => commit()}
          disabled={!isValid || !isDirty}
          variant="contained"
        >
          Save
        </Button>
      </DialogActions>
    </>
  );
};
