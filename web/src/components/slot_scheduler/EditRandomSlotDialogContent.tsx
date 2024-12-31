import { betterHumanize } from '@/helpers/dayjs.ts';
import { ProgramOption, getRandomSlotId } from '@/helpers/slotSchedulerUtil';
import { showOrderOptions } from '@/helpers/slotSchedulerUtil.ts';
import { countWhere } from '@/helpers/util.ts';
import { useScheduledSlotProgramDetails } from '@/hooks/slot_scheduler/useScheduledSlotProgramDetails.ts';
import { useRandomSlotFormContext } from '@/hooks/useRandomSlotFormContext.ts';
import { Warning } from '@mui/icons-material';
import {
  Box,
  Button,
  DialogActions,
  DialogContent,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tooltip,
} from '@mui/material';
import { TimePicker } from '@mui/x-date-pickers';
import { RandomSlot } from '@tunarr/types/api';
import dayjs, { Dayjs } from 'dayjs';
import { isNil, map } from 'lodash-es';
import pluralize from 'pluralize';
import { useCallback, useMemo } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { EditSlotProgrammingForm } from './EditSlotProgrammingForm.tsx';

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
  const { slotArray } = useRandomSlotFormContext();

  const formMethods = useForm({
    defaultValues: slot,
  });
  const { control, watch, getValues } = formMethods;

  const [programming, slotDuration] = watch([`programming`, 'durationMs']);
  const isShowType =
    programming.type === 'custom-show' || programming.type === 'show';

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

  const slotId = getRandomSlotId(programming);
  const programDetails = useScheduledSlotProgramDetails([slotId]);
  const overTimeCount = useMemo(() => {
    if (programDetails[slotId]) {
      return countWhere(
        programDetails[slotId]?.programDurations,
        ({ duration }) => duration > slotDuration,
      );
    }
    return 0;
  }, [programDetails, slotDuration, slotId]);

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
              <Controller
                control={control}
                name="durationMs"
                render={({ field, fieldState: { error } }) => {
                  return (
                    <TimePicker
                      reduceAnimations
                      format="H[h] m[m] s[s]"
                      {...field}
                      value={dayjs().startOf('day').add(field.value)}
                      onChange={(value) =>
                        updateSlotTime(value, field.onChange)
                      }
                      label="Duration"
                      closeOnSelect={false}
                      slotProps={{
                        textField: {
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
              <Box>
                {overTimeCount > 0 && (
                  <Tooltip
                    title={`There ${pluralize(
                      'is',
                      overTimeCount,
                    )} ${overTimeCount} ${pluralize(
                      'program',
                      overTimeCount,
                    )} that exceed the length of this slot.`}
                  >
                    <IconButton
                      // onClick={() => setCurrentSlotWarningsIndex(row.index)}
                      size="small"
                      sx={{ fontSize: '1rem', py: 0 }}
                      disableRipple
                    >
                      <Warning sx={{ fontSize: 'inherit' }} color="warning" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
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
