import { NumericFormControllerText } from '@/components/util/TypedController.tsx';
import {
  getApiSettingsMediaSourceOptions,
  getApiSettingsMediaSourceQueryKey,
  getApiTasksOptions,
  getApiTasksQueryKey,
  putApiSettingsMediaSourceMutation,
} from '@/generated/@tanstack/react-query.gen.ts';
import { getApiErrorMessage } from '@/helpers/apiError.ts';
import { useDayjs } from '@/hooks/useDayjs.ts';
import { plural } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import {
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormHelperText,
  FormLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { TimePicker } from '@mui/x-date-pickers';
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { LibraryScanIntervalHours } from '@tunarr/types/schemas';
import { isNumber, minBy, range } from 'lodash-es';
import { useSnackbar } from 'notistack';
import { useCallback, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { ScanScheduleFormValues } from './scanScheduleForm.ts';
import {
  formValuesToScanSchedule,
  isLibraryScanIntervalHour,
  scanScheduleToFormValues,
} from './scanScheduleForm.ts';

const ScanLibrariesTaskId = 'ScanLibrariesTask';

export const ScannerSettingsPage = () => {
  const { t } = useLingui();
  const dayjs = useDayjs();
  const queryClient = useQueryClient();
  const snackbar = useSnackbar();

  const { data: mediaSourceSettings } = useSuspenseQuery(
    getApiSettingsMediaSourceOptions(),
  );
  const { data: tasks } = useQuery(getApiTasksOptions());

  const settingsForm = useForm<ScanScheduleFormValues>({
    defaultValues: scanScheduleToFormValues(mediaSourceSettings.scanSchedule),
  });
  const { control, watch, setValue } = settingsForm;
  const scheduleType = watch('type');

  const weekdays = useMemo(() => {
    const localeData = dayjs().localeData();
    const names = localeData.weekdaysShort();
    const first = localeData.firstDayOfWeek();
    return range(0, 7).map((offset) => {
      const day = (first + offset) % 7;
      return { day, name: names[day] };
    });
  }, [dayjs]);

  const nextScanEpoch = minBy(
    tasks
      ?.find((task) => task.id === ScanLibrariesTaskId)
      ?.scheduledTasks.map((scheduled) => scheduled.nextExecutionEpoch)
      .filter(isNumber),
  );

  const updateMediaSourceSettingsMut = useMutation({
    ...putApiSettingsMediaSourceMutation(),
    onSuccess: async (returned) => {
      settingsForm.reset(scanScheduleToFormValues(returned.scanSchedule));
      queryClient.setQueryData(getApiSettingsMediaSourceQueryKey(), returned);
      snackbar.enqueueSnackbar({
        variant: 'success',
        message: t`Successfully updated scanner settings.`,
      });
      await queryClient.invalidateQueries({
        queryKey: getApiTasksQueryKey(),
      });
    },
    onError: (err) => {
      console.error(err);
      const message =
        getApiErrorMessage(err) ??
        t`Please check server and browser logs for details.`;
      snackbar.enqueueSnackbar({
        variant: 'error',
        message: t`Failed to update scanner settings. ${message}`,
      });
    },
  });

  const onSubmit = useCallback(
    (data: ScanScheduleFormValues) => {
      updateMediaSourceSettingsMut.mutate({
        body: { scanSchedule: formValuesToScanSchedule(data) },
      });
    },
    [updateMediaSourceSettingsMut],
  );

  const onError = useCallback(() => {
    snackbar.enqueueSnackbar({
      variant: 'error',
      message: t`There was an error submitting the request to update scanner settings. Please check the form and try again`,
    });
  }, [snackbar, t]);

  const renderNextScan = () => {
    if (mediaSourceSettings.scanSchedule.type === 'off') {
      return (
        <Trans>
          Scheduled scans are off. You can still scan a library by hand from its
          media source.
        </Trans>
      );
    }

    if (isNumber(nextScanEpoch)) {
      const next = dayjs(nextScanEpoch * 1000).format('llll');
      return <Trans>Next scan: {next}</Trans>;
    }

    return null;
  };

  return (
    <Stack>
      <Box
        component="form"
        onSubmit={settingsForm.handleSubmit(onSubmit, onError)}
      >
        <Stack gap={2}>
          <FormControl fullWidth>
            <InputLabel id="scan-schedule-type-label">
              <Trans>Scheduled scans</Trans>
            </InputLabel>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <Select
                  {...field}
                  labelId="scan-schedule-type-label"
                  label={t`Scheduled scans`}
                >
                  <MenuItem value="off">
                    <Trans>Off</Trans>
                  </MenuItem>
                  <MenuItem value="interval">
                    <Trans>Every few hours</Trans>
                  </MenuItem>
                  <MenuItem value="days">
                    <Trans>On selected days</Trans>
                  </MenuItem>
                  <MenuItem value="cron">
                    <Trans>Custom (cron)</Trans>
                  </MenuItem>
                </Select>
              )}
            />
            <FormHelperText>
              <Trans>
                Scans every enabled library on this schedule. Collection and
                playlist sync from media servers run on the same schedule.
              </Trans>
            </FormHelperText>
          </FormControl>

          {scheduleType === 'interval' && (
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
              <FormControl sx={{ minWidth: 200 }}>
                <InputLabel id="scan-interval-hours-label">
                  <Trans>Frequency</Trans>
                </InputLabel>
                <Controller
                  control={control}
                  name="intervalHours"
                  render={({ field }) => (
                    <Select
                      {...field}
                      labelId="scan-interval-hours-label"
                      label={t`Frequency`}
                      onChange={(ev) => {
                        const hours = Number(ev.target.value);
                        if (isLibraryScanIntervalHour(hours)) {
                          field.onChange(hours);
                        }
                      }}
                    >
                      {LibraryScanIntervalHours.map((hours) => (
                        <MenuItem key={hours} value={hours}>
                          {plural(hours, {
                            one: 'Every hour',
                            other: 'Every # hours',
                          })}
                        </MenuItem>
                      ))}
                    </Select>
                  )}
                />
              </FormControl>
              <NumericFormControllerText
                control={control}
                name="intervalMinute"
                prettyFieldName={t`Minute`}
                rules={{ min: 0, max: 59, required: true }}
                TextFieldProps={{
                  label: t`Minute`,
                  helperText: t`Minute past the hour, 0 to 59. Hours count from midnight.`,
                }}
              />
            </Stack>
          )}

          {scheduleType === 'days' && (
            <Stack gap={2}>
              <FormControl>
                <FormLabel>
                  <Trans>Days</Trans>
                </FormLabel>
                <Controller
                  control={control}
                  name="daysOfWeek"
                  rules={{
                    validate: (days) =>
                      days.length > 0 || t`Pick at least one day.`,
                  }}
                  render={({ field, fieldState }) => (
                    <>
                      <FormGroup row aria-label={t`Days`}>
                        {weekdays.map(({ day, name }) => (
                          <FormControlLabel
                            key={day}
                            label={name}
                            control={
                              <Checkbox
                                checked={field.value.includes(day)}
                                onChange={(_, checked) =>
                                  field.onChange(
                                    checked
                                      ? [...field.value, day]
                                      : field.value.filter((d) => d !== day),
                                  )
                                }
                              />
                            }
                          />
                        ))}
                      </FormGroup>
                      {fieldState.error && (
                        <FormHelperText error>
                          {fieldState.error.message}
                        </FormHelperText>
                      )}
                    </>
                  )}
                />
              </FormControl>
              <Controller
                control={control}
                name="hour"
                render={({ field }) => (
                  <TimePicker
                    label={t`Time`}
                    value={dayjs()
                      .startOf('day')
                      .hour(field.value)
                      .minute(watch('minute'))}
                    onChange={(value) => {
                      if (!value || !value.isValid()) {
                        return;
                      }
                      field.onChange(value.hour());
                      setValue('minute', value.minute(), {
                        shouldDirty: true,
                      });
                    }}
                    sx={{ maxWidth: 200 }}
                  />
                )}
              />
            </Stack>
          )}

          {scheduleType === 'cron' && (
            <Controller
              control={control}
              name="cron"
              rules={{
                validate: (cron) =>
                  cron.trim().length > 0 || t`Enter a cron expression.`,
              }}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label={t`Cron expression`}
                  placeholder="0 4 * * 0"
                  error={!!fieldState.error}
                  helperText={
                    fieldState.error?.message ??
                    t`Five fields, or six with seconds first. For example, "0 4 * * 0" scans at 4:00 AM every Sunday.`
                  }
                />
              )}
            />
          )}

          <Typography variant="body2" color="text.secondary">
            {renderNextScan()}
          </Typography>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="submit"
              variant="contained"
              disabled={
                !settingsForm.formState.isDirty ||
                updateMediaSourceSettingsMut.isPending
              }
            >
              <Trans>Save</Trans>
            </Button>
          </Box>
        </Stack>
      </Box>
    </Stack>
  );
};
