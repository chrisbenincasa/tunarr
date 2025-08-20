import { useAddBreaks } from '@/hooks/programming_controls/useAddBreaks';
import {
  Box,
  DialogContentText,
  FormControl,
  FormHelperText,
  Stack,
} from '@mui/material';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { TimeField } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import { isNil } from 'lodash-es';
import type { SubmitHandler } from 'react-hook-form';
import { Controller, useForm } from 'react-hook-form';
import { betterHumanize } from '../../helpers/dayjs.ts';

type AddBreaksModalProps = {
  open: boolean;
  onClose: () => void;
};

type AddBreaksForm = {
  afterDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
};

const AddBreaksModal = ({ open, onClose }: AddBreaksModalProps) => {
  const addBreaks = useAddBreaks();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<AddBreaksForm>({
    mode: 'onChange',
    defaultValues: {
      afterDurationMs: +dayjs.duration({ minutes: 5 }),
      minDurationMs: +dayjs.duration({ seconds: 10 }),
      maxDurationMs: +dayjs.duration({ seconds: 120 }),
    },
  });

  const doSubmit: SubmitHandler<AddBreaksForm> = (data) => {
    addBreaks({
      afterDuration: dayjs.duration(data.afterDurationMs),
      maxDuration: dayjs.duration(data.maxDurationMs),
      minDuration: dayjs.duration(data.minDurationMs),
    });
    onClose();
  };

  return (
    <Dialog
      open={open}
      component="form"
      onSubmit={handleSubmit(doSubmit, console.error)}
    >
      <DialogTitle>Add Breaks</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Adds Flex breaks between programs, attempting to avoid groups of
          consecutive programs that exceed the specified number of minutes.
        </DialogContentText>
        <Box sx={{ mt: 2 }}>
          <Stack flex={1} gap={1}>
            <Controller
              control={control}
              name="afterDurationMs"
              render={({ field, fieldState: { error } }) => (
                <TimeField
                  format="H[h] m[m]"
                  {...field}
                  value={dayjs().startOf('day').add(field.value)}
                  onChange={(value) => {
                    if (isNil(value)) {
                      return;
                    }
                    field.onChange(
                      +dayjs.duration({
                        hours: value.hour(),
                        minutes: value.minute(),
                      }),
                    );
                  }}
                  label="After Every"
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      error: !isNil(error),
                      helperText:
                        field.value === 0
                          ? 'after every program'
                          : betterHumanize(dayjs.duration(field.value), {
                              exact: true,
                              style: 'full',
                            }),
                    },
                  }}
                />
              )}
            />
            <FormControl fullWidth sx={{ flexGrow: 1 }}>
              <Controller
                control={control}
                name="minDurationMs"
                rules={{
                  min: 1,
                }}
                render={({ field, fieldState: { error } }) => (
                  <TimeField
                    format="H[h] m[m] s[s]"
                    {...field}
                    value={dayjs().startOf('day').add(field.value)}
                    onChange={(value) => {
                      if (isNil(value)) {
                        return;
                      }
                      field.onChange(
                        +dayjs.duration({
                          hours: value.hour(),
                          minutes: value.minute(),
                          seconds: value.second(),
                        }),
                      );
                    }}
                    label="Min Duration"
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
                )}
              />
              {errors.minDurationMs && (
                <FormHelperText error={true}>
                  {errors.minDurationMs.message}
                </FormHelperText>
              )}
            </FormControl>
            <FormControl sx={{ display: 'flex', flexGrow: 1 }}>
              <Controller
                control={control}
                name="maxDurationMs"
                rules={{
                  max: +dayjs.duration({ days: 1 }),
                }}
                render={({ field, fieldState: { error } }) => (
                  <TimeField
                    format="H[h] m[m] s[s]"
                    {...field}
                    value={dayjs().startOf('day').add(field.value)}
                    onChange={(value) => {
                      if (isNil(value)) {
                        return;
                      }
                      field.onChange(
                        +dayjs.duration({
                          hours: value.hour(),
                          minutes: value.minute(),
                          seconds: value.second(),
                        }),
                      );
                    }}
                    label="Max Duration"
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
                )}
              />
              {errors.maxDurationMs && (
                <FormHelperText error={true}>
                  {errors.maxDurationMs.message}
                </FormHelperText>
              )}
            </FormControl>
          </Stack>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()}>Cancel</Button>
        <Button variant="contained" type="submit">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddBreaksModal;
