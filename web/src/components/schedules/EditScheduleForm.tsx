import {
  Box,
  Button,
  FormControl,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { prettifySnakeCaseString } from '@tunarr/shared/util';
import { SlotPlaybackOrder, type Schedule } from '@tunarr/types/api';
import { useSnackbar } from 'notistack';
import { useCallback } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { v4 } from 'uuid';
import {
  postApiSchedulesMutation,
  updateScheduleByIdMutation,
} from '../../generated/@tanstack/react-query.gen.ts';
import { flexOptions, padOptions } from '../../helpers/slotSchedulerUtil.ts';

type Props = {
  schedule?: Schedule;
};

function newSchedule() {
  return {
    uuid: v4(),
    name: 'New Schedule',
    bufferDays: 2,
    bufferThresholdDays: 1,
    createdAt: null,
    enabled: true,
    flexPreference: 'end',
    padMs: 1,
    slots: [],
    timeZoneOffset: new Date().getTimezoneOffset(),
    updatedAt: null,
    slotPlaybackOrder: 'ordered',
  } satisfies Schedule;
}

export const EditScheduleForm = ({ schedule }: Props) => {
  const navigate = useNavigate();
  const form = useForm<Schedule>({
    defaultValues: schedule ?? newSchedule(),
  });

  const { control, reset } = form;
  const { isDirty, isSubmitting, isValid } = form.formState;

  const snackbar = useSnackbar();

  const createSchedule = useMutation({
    ...postApiSchedulesMutation(),
    onSuccess: () => {
      snackbar.enqueueSnackbar({
        message: 'Successfully created new schedule',
        variant: 'success',
      });
      navigate({
        to: '/schedules',
      }).catch(console.error);
    },
  });

  const updateSchedule = useMutation({
    ...updateScheduleByIdMutation(),
    onSuccess: () => {
      snackbar.enqueueSnackbar({
        message: 'Successfully updated schedule',
        variant: 'success',
      });
    },
  });

  const onSubmit = useCallback(
    (formData: Schedule) => {
      if (schedule) {
        updateSchedule.mutate({ body: formData, path: { id: schedule.uuid } });
      } else {
        createSchedule.mutate({ body: formData });
      }
    },
    [createSchedule, schedule, updateSchedule],
  );

  const onError = useCallback(() => {}, []);

  return (
    <Box component={'form'} onSubmit={form.handleSubmit(onSubmit, onError)}>
      <Stack spacing={2}>
        <Controller
          control={control}
          name="name"
          rules={{
            required: true,
            minLength: 1,
          }}
          render={({ field }) => (
            <TextField fullWidth label="Name" {...field} />
          )}
        />
        <Grid container sx={{ mt: 0 }} spacing={2}>
          <Grid size={{ md: 6, xs: 12 }}>
            <FormControl fullWidth>
              <InputLabel>Pad Times</InputLabel>
              <Controller
                control={control}
                name="padMs"
                render={({ field }) => (
                  <Select label="Pad Times" {...field}>
                    {padOptions.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.description}
                      </MenuItem>
                    ))}
                  </Select>
                )}
              />

              <FormHelperText>
                The schedule's default start times for all programs in all
                slots. In order to get programs in slots to start on the
                selected set of times, filler time will be added. This setting
                can be overriden for any slot.
              </FormHelperText>
            </FormControl>
          </Grid>
          <Grid size={{ sm: 12, md: 6 }}>
            <FormControl fullWidth>
              <InputLabel>Flex Style</InputLabel>
              <Controller
                control={control}
                name="flexPreference"
                render={({ field }) => (
                  <Select label="Flex Style" {...field}>
                    {flexOptions.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.description}
                      </MenuItem>
                    ))}
                  </Select>
                )}
              />
              <FormHelperText>
                Usually slots need to add flex time to ensure that the next slot
                starts at the correct time. When there are multiple videos in
                the slot, you might prefer to distribute the flex time between
                the videos or to place most of the flex time at the end of the
                slot.
              </FormHelperText>
            </FormControl>
          </Grid>
          <Grid size={{ sm: 12, md: 6 }}>
            <FormControl fullWidth>
              <InputLabel>Slot Playback Order</InputLabel>
              <Controller
                control={control}
                name="slotPlaybackOrder"
                render={({ field }) => (
                  <Select label="Slot Playback Orde" {...field}>
                    {SlotPlaybackOrder.map((opt) => (
                      <MenuItem key={opt} value={opt}>
                        {prettifySnakeCaseString(opt)}
                      </MenuItem>
                    ))}
                  </Select>
                )}
              />
              <FormHelperText>
                <strong>Ordered:</strong> slots are played back in the order
                defined.
                <br />
                <strong>Shuffle:</strong> slots are shuffled before scheduling.
              </FormHelperText>
            </FormControl>
          </Grid>
        </Grid>
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
    </Box>
  );
};
