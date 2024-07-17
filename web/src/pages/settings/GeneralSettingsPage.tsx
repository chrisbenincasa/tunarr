import { CloudDoneOutlined, CloudOff } from '@mui/icons-material';
import {
  Box,
  Checkbox,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import {
  CacheSettings,
  LogLevel,
  LogLevels,
  SystemSettings,
} from '@tunarr/types';
import { first, isNull, map, trim, trimEnd } from 'lodash-es';
import { useCallback } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { RotatingLoopIcon } from '../../components/base/LoadingIcon.tsx';
import DarkModeButton from '../../components/settings/DarkModeButton.tsx';
import {
  useSystemSettings,
  useUpdateSystemSettings,
} from '../../hooks/useSystemSettings.ts';
import { useVersion } from '../../hooks/useVersion.ts';
import { setBackendUri } from '../../store/settings/actions.ts';
import { useSettings } from '../../store/settings/selectors.ts';
import { UpdateSystemSettingsRequest } from '@tunarr/types/api';
import { BackupSettings, EverySchedule } from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import { NumericFormControllerText } from '../../components/util/TypedController.tsx';
import Grid2 from '@mui/material/Unstable_Grid2/Grid2';
import pluralize from 'pluralize';
import { TimePicker } from '@mui/x-date-pickers';
import { useSnackbar } from 'notistack';
import { isValidUrl } from '@/helpers/util.ts';

type GeneralSettingsFormData = {
  backendUri: string;
  logLevel: LogLevel | 'env';
  backup: BackupSettings;
  cache: CacheSettings;
};

type GeneralSetingsFormProps = {
  systemSettings: SystemSettings;
};

const LogLevelChoices = [
  {
    description: 'Use environment settings',
    value: 'env',
  },
  ...map(LogLevels, (level) => ({
    description: level,
    value: level,
  })),
];

function GeneralSettingsForm({ systemSettings }: GeneralSetingsFormProps) {
  const settings = useSettings();
  const snackbar = useSnackbar();
  const versionInfo = useVersion({
    retry: 0,
  });
  const theme = useTheme();

  const { isLoading, isError } = versionInfo;

  const updateSystemSettings = useUpdateSystemSettings();

  const getBaseFormValues = (
    systemSettings: SystemSettings,
  ): GeneralSettingsFormData => ({
    backendUri: settings.backendUri,
    logLevel: systemSettings.logging.useEnvVarLevel
      ? 'env'
      : systemSettings.logging.logLevel,
    backup: systemSettings.backup,
    cache: systemSettings.cache ?? {
      enablePlexRequestCache: false,
    },
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty, isValid, isSubmitting },
    watch,
    setValue,
  } = useForm<GeneralSettingsFormData>({
    reValidateMode: 'onChange',
    defaultValues: getBaseFormValues(systemSettings),
  });

  const { remove, append } = useFieldArray({
    control,
    name: 'backup.configurations',
  });

  const backupsValue = watch('backup');
  const backupsEnabled = backupsValue.configurations.length > 0;
  const currentBackupSchedule = first(backupsValue.configurations)?.schedule as
    | EverySchedule
    | undefined;

  const onSave = (data: GeneralSettingsFormData) => {
    const newBackendUri = trimEnd(trim(data.backendUri), '/');
    setBackendUri(newBackendUri);
    snackbar.enqueueSnackbar('Settings Saved!', {
      variant: 'success',
    });
    const updateReq: UpdateSystemSettingsRequest = {
      logging: {
        logLevel: data.logLevel === 'env' ? undefined : data.logLevel,
        useEnvVarLevel: data.logLevel === 'env',
      },
      backup: data.backup,
      cache: data.cache,
    };
    updateSystemSettings.mutate(updateReq, {
      onSuccess(data) {
        reset(getBaseFormValues(data), { keepDirty: false });
      },
    });
  };

  const toggleBackupEnabled = useCallback(() => {
    if (backupsEnabled) {
      remove();
    } else {
      append({
        enabled: true,
        outputs: [
          {
            type: 'file',
            archiveFormat: 'tar',
            maxBackups: 3,
            outputPath: '',
          },
        ],
        schedule: {
          type: 'every',
          increment: 1,
          unit: 'day',
          offsetMs: dayjs.duration({ hours: 3 }).asMilliseconds(),
        },
      });
    }
  }, [append, backupsEnabled, remove]);

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

  function renderBackupsForm() {
    return (
      <Grid2 container spacing={2}>
        <Grid2 xs={12}>
          <FormControl fullWidth>
            <FormControlLabel
              control={
                <Checkbox
                  checked={backupsEnabled}
                  onChange={toggleBackupEnabled}
                />
              }
              label="Enable Backups"
            />
          </FormControl>
        </Grid2>
        {backupsEnabled && (
          <>
            <Grid2 xs={6}>
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
            </Grid2>
            <Grid2 xs={3}>
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
            </Grid2>
            <Grid2 xs={3}>
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
            </Grid2>
            <Grid2 xs={6}>
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
                  <TimePicker
                    value={dayjs()
                      .startOf('day')
                      .add(currentBackupSchedule!.offsetMs)}
                    onChange={(value) =>
                      setValue(
                        'backup.configurations.0.schedule.offsetMs',
                        isNull(value)
                          ? 0
                          : value
                              .mod(dayjs.duration(1, 'day'))
                              .asMilliseconds(),
                        { shouldDirty: true },
                      )
                    }
                  />
                )}
              </Stack>
            </Grid2>
          </>
        )}
      </Grid2>
    );
  }

  return (
    <Box component="form" onSubmit={handleSubmit(onSave, console.error)}>
      <Stack gap={2} spacing={2}>
        <Typography variant="h5" sx={{ mb: 1 }}>
          Server Settings
        </Typography>
        <Box>
          <Controller
            control={control}
            name="backendUri"
            rules={{ validate: { isValidUrl } }}
            render={({ field, fieldState: { error } }) => (
              <TextField
                fullWidth
                label="Tunarr Backend URL"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      {isLoading ? (
                        <RotatingLoopIcon />
                      ) : !isError ? (
                        <CloudDoneOutlined color="success" />
                      ) : (
                        <CloudOff color="error" />
                      )}
                    </InputAdornment>
                  ),
                }}
                {...field}
                helperText={
                  error?.type === 'isValidUrl'
                    ? 'Must use a valid URL, or empty.'
                    : 'Set the host of your Tunarr backend. When empty, the web UI will use the current host/port to communicate with the backend.'
                }
              />
            )}
          />
        </Box>
        <Box>
          <FormControl sx={{ width: '50%' }}>
            <InputLabel id="log-level-label">Log Level</InputLabel>
            <Controller
              name="logLevel"
              control={control}
              render={({ field }) => (
                <Select
                  labelId="log-level-label"
                  id="log-level"
                  label="Log Level"
                  {...field}
                >
                  {map(LogLevelChoices, ({ value, description }) => (
                    <MenuItem key={value} value={value}>
                      {description}
                    </MenuItem>
                  ))}
                </Select>
              )}
            />
            <FormHelperText>
              Set the log level for the Tunarr server.
              <br />
              Selecting <strong>"Use environment settings"</strong> will
              instruct the server to use the <code>LOG_LEVEL</code> environment
              variable, if set, or system default "info".
            </FormHelperText>
          </FormControl>
        </Box>
        <Box>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Backups
          </Typography>
          {renderBackupsForm()}
        </Box>
        <Box>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Caching
          </Typography>
          <Box>
            <FormControl sx={{ width: '50%' }}>
              <FormControlLabel
                control={
                  <Controller
                    control={control}
                    name="cache.enablePlexRequestCache"
                    render={({ field }) => (
                      <Checkbox checked={field.value} {...field} />
                    )}
                  />
                }
                label={
                  <span>
                    <strong>Experimental:</strong> Enable Plex Request Cache{' '}
                    <Tooltip
                      title="Temporarily caches responses from Plex based by request path. Could potentially speed up channel editing."
                      placement="top"
                    >
                      <sup style={{ color: theme.palette.primary.main }}>
                        [?]
                      </sup>
                    </Tooltip>
                  </span>
                }
              />
              <FormHelperText>
                This feature is currently experimental. Proceed with caution and
                if you experience an issue, try disabling caching.
              </FormHelperText>
            </FormControl>
          </Box>
        </Box>
      </Stack>
      <Stack spacing={2} direction="row" justifyContent="right" sx={{ mt: 2 }}>
        {isDirty && (
          <Button
            variant="outlined"
            onClick={() => {
              reset(settings);
            }}
            disabled={!isValid || isSubmitting || !isDirty}
          >
            Reset Options
          </Button>
        )}
        <Button
          variant="contained"
          type="submit"
          disabled={!isValid || isSubmitting || !isDirty}
        >
          Save
        </Button>
      </Stack>
    </Box>
  );
}

export default function GeneralSettingsPage() {
  const systemSettings = useSystemSettings();

  // TODO: Handle loading and error states.

  return (
    systemSettings.data && (
      <Box>
        <Stack direction="column" gap={2}>
          <Box>
            <Typography variant="h5" sx={{ mb: 2 }}>
              Theme Settings
            </Typography>
            <DarkModeButton />
            <FormHelperText>
              This setting is stored in your browser and is saved automatically
              when changed.
            </FormHelperText>
          </Box>
          <Divider />
          <GeneralSettingsForm systemSettings={systemSettings.data} />
        </Stack>
      </Box>
    )
  );
}
