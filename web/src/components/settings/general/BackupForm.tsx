import type { SelectChangeEvent } from '@mui/material';
import {
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { TimePicker } from '@mui/x-date-pickers';
import type { EverySchedule } from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import { first } from 'lodash-es';
import pluralize from 'pluralize';
import { Controller, useFormContext } from 'react-hook-form';
import { NumericFormControllerText } from '../../util/TypedController.tsx';
import type { GeneralSettingsFormData } from './GeneralSettingsForm.tsx';

export const BackupForm = () => {
  const { control, watch, setValue } =
    useFormContext<GeneralSettingsFormData>();

  const backupsValue = watch('backup');
  const currentBackupSchedule = first(backupsValue.configurations)?.schedule as
    | EverySchedule
    | undefined;

  function handleArchiveFormatUpdate(ev: SelectChangeEvent) {
    if (ev.target.value === 'zip' || ev.target.value === 'tar') {
      setValue(
        'backup.configurations.0.outputs.0.archiveFormat',
        ev.target.value,
        { shouldDirty: true },
      );
      setValue('backup.configurations.0.outputs.0.gzip', false, {
        shouldDirty: true,
      });
    } else if (ev.target.value === 'targz') {
      setValue('backup.configurations.0.outputs.0.archiveFormat', 'tar', {
        shouldDirty: true,
      });
      setValue('backup.configurations.0.outputs.0.gzip', true, {
        shouldDirty: true,
      });
    }
  }

  function handleBackupTimeChange(
    value: dayjs.Dayjs | null,
    originalOnChange: (...args: unknown[]) => void,
  ) {
    if (!value) {
      originalOnChange(0);
      return;
    }

    const h = value.hour();
    const m = value.minute();
    const millis = dayjs.duration({ hours: h, minutes: m }).asMilliseconds();
    originalOnChange(millis);
  }

  return (
    <>
      <Grid size={{ xs: 6 }}>
        <Controller
          control={control}
          name="backup.configurations.0.outputs.0.outputPath"
          render={({ field }) => (
            <TextField
              fullWidth
              label="Output Path"
              {...field}
              helperText="By default, saves backups in the server's run directory, or, if running in Docker, to /config/tunarr/backups"
            />
          )}
        />
      </Grid>
      <Grid size={{ xs: 3 }}>
        <NumericFormControllerText
          control={control}
          name="backup.configurations.0.outputs.0.maxBackups"
          prettyFieldName="Max Backups"
          rules={{ min: 0 }}
          TextFieldProps={{
            label: 'Max Backups',
            helperText: 'Set to 0 to never delete backups',
          }}
        />
      </Grid>
      <Grid size={{ xs: 3 }}>
        <FormControl fullWidth>
          <InputLabel>Archive Format</InputLabel>
          <Controller
            control={control}
            name="backup.configurations.0.outputs.0.archiveFormat"
            render={({ field }) => (
              <Select
                {...field}
                value={
                  field.value === 'tar' &&
                  backupsValue.configurations[0].outputs[0].gzip
                    ? 'targz'
                    : field.value
                }
                label="Archive Format"
                onChange={(ev) => handleArchiveFormatUpdate(ev)}
              >
                <MenuItem value="zip">.zip</MenuItem>
                <MenuItem value="tar">.tar</MenuItem>
                <MenuItem value="targz">.tar.gz</MenuItem>
              </Select>
            )}
          />
        </FormControl>
      </Grid>
      <Grid size={{ xs: 6 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Typography>Every</Typography>
          <NumericFormControllerText
            control={control}
            name="backup.configurations.0.schedule.increment"
            prettyFieldName="Max Backups"
            rules={{ min: 1 }}
            TextFieldProps={{
              sx: { width: '30%' },
            }}
          />
          <Controller
            control={control}
            name="backup.configurations.0.schedule.unit"
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
              name="backup.configurations.0.schedule.offsetMs"
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
      </Grid>
    </>
  );
};
