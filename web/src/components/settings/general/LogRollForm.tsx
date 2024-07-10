import {
  Checkbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import { TimePicker } from '@mui/x-date-pickers';
import type { EverySchedule } from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import pluralize from 'pluralize';
import { useCallback } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { formatBytes } from '../../../helpers/util.ts';
import {
  CheckboxFormController,
  NumericFormControllerText,
} from '../../util/TypedController.tsx';
import type { GeneralSettingsFormData } from './GeneralSettingsForm.tsx';

export const LogRollForm = () => {
  const { control, watch, setValue } =
    useFormContext<GeneralSettingsFormData>();
  const [enabled, schedule] = watch([
    'logging.logRollConfig.enabled',
    'logging.logRollConfig.schedule',
  ]);
  const currentBackupSchedule = schedule as EverySchedule | undefined;

  const handleBackupTimeChange = useCallback(
    (
      value: dayjs.Dayjs | null,
      originalOnChange: (...args: unknown[]) => void,
    ) => {
      if (!value) {
        originalOnChange(0);
        return;
      }

      const h = value.hour();
      const m = value.minute();
      const millis = dayjs.duration({ hours: h, minutes: m }).asMilliseconds();
      originalOnChange(millis);
    },
    [],
  );

  return (
    <Stack gap={2}>
      <FormControl>
        <FormControlLabel
          label="Enable Log File Rolling"
          control={
            <CheckboxFormController
              control={control}
              name="logging.logRollConfig.enabled"
            />
          }
        />
        <FormHelperText>
          Enable rolling log files using time and/or size based criteria
        </FormHelperText>
      </FormControl>
      {enabled && (
        <>
          <Grid size={{ xs: 6 }}>
            <FormControl>
              <FormControlLabel
                label="Roll on Schedule"
                control={
                  <Controller
                    control={control}
                    name="logging.logRollConfig.schedule.increment"
                    render={({ field }) => (
                      <Checkbox
                        checked={(field.value ?? 0) > 0}
                        onChange={(_, checked) => {
                          field.onChange(checked ? 1 : 0);
                          setValue(
                            'logging.logRollConfig.schedule.unit',
                            'day',
                            { shouldDirty: true },
                          );
                          setValue(
                            'logging.logRollConfig.schedule.offsetMs',
                            0,
                            { shouldDirty: true },
                          );
                        }}
                      />
                    )}
                  />
                }
              />
              <FormHelperText>
                Roll the log file on a fixed schedule, regardless of file size.
              </FormHelperText>
            </FormControl>
            {(currentBackupSchedule?.increment ?? 0) > 0 && (
              <Stack direction="row" alignItems="center" spacing={2}>
                <Typography>Every</Typography>
                <NumericFormControllerText
                  control={control}
                  name="logging.logRollConfig.schedule.increment"
                  prettyFieldName="Max Backups"
                  rules={{ min: 1 }}
                  TextFieldProps={{
                    sx: { width: '30%' },
                  }}
                />
                <Controller
                  control={control}
                  name="logging.logRollConfig.schedule.unit"
                  render={({ field }) => (
                    <Select
                      {...field}
                      value={
                        field.value === 'day' || field.value === 'hour'
                          ? field.value
                          : 'day'
                      }
                      sx={{ minWidth: '25%' }}
                    >
                      <MenuItem value="hour">
                        {pluralize('Hour', currentBackupSchedule!.increment)}
                      </MenuItem>
                      <MenuItem value="day">
                        {pluralize('Day', currentBackupSchedule!.increment)}
                      </MenuItem>
                    </Select>
                  )}
                />

                {currentBackupSchedule!.unit === 'day' && (
                  <Controller
                    control={control}
                    name="logging.logRollConfig.schedule.offsetMs"
                    render={({ field }) => (
                      <TimePicker
                        value={dayjs()
                          .startOf('day')
                          .add(currentBackupSchedule!.offsetMs)}
                        onChange={(value) =>
                          handleBackupTimeChange(value, field.onChange)
                        }
                      />
                    )}
                  />
                )}
              </Stack>
            )}
          </Grid>
          <Stack direction={'row'}>
            <FormControl fullWidth>
              <FormControlLabel
                label="Roll based on size"
                control={
                  <Controller
                    control={control}
                    name="logging.logRollConfig.maxFileSizeBytes"
                    render={({ field }) => (
                      <Checkbox
                        checked={(field.value ?? 0) > 0}
                        onChange={(_, checked) => {
                          field.onChange(checked ? Math.pow(2, 20) : 0);
                          setValue(
                            'logging.logRollConfig.schedule.unit',
                            'day',
                            {
                              shouldDirty: true,
                            },
                          );
                        }}
                      />
                    )}
                  />
                }
              />
              <FormHelperText>
                Roll the log file on a fixed schedule, regardless of file size.
              </FormHelperText>
            </FormControl>
            <NumericFormControllerText
              control={control}
              name="logging.logRollConfig.maxFileSizeBytes"
              TextFieldProps={{
                fullWidth: true,
                label: 'Max file size (bytes)',
                helperText: ({ field }) =>
                  field.value ? `${formatBytes(field.value)}` : '',
              }}
            />
          </Stack>
        </>
      )}
    </Stack>
  );
};
