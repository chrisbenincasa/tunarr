import { RotatingLoopIcon } from '@/components/base/LoadingIcon.tsx';
import { NumericFormControllerText } from '@/components/util/TypedController.tsx';
import { isValidUrl } from '@/helpers/util.ts';
import {
  useSystemState,
  useUpdateSystemSettings,
} from '@/hooks/useSystemSettings.ts';
import { useVersion } from '@/hooks/useVersion.tsx';
import { setBackendUri } from '@/store/settings/actions.ts';
import { useSettings } from '@/store/settings/selectors.ts';
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
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import type { LoggingSettings } from '@tunarr/types';
import {
  LogLevels,
  type CacheSettings,
  type LogLevel,
  type ServerSettings,
  type SystemSettings,
} from '@tunarr/types';
import { type UpdateSystemSettingsRequest } from '@tunarr/types/api';
import { type BackupSettings } from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import { map, trim, trimEnd } from 'lodash-es';
import { useSnackbar } from 'notistack';
import { useCallback } from 'react';
import {
  Controller,
  FormProvider,
  useFieldArray,
  useForm,
} from 'react-hook-form';
import type { SettingsStateInternal } from '../../../store/settings/store.ts';
import { BackupForm } from './BackupForm.tsx';
import { LogRollForm } from './LogRollForm.tsx';

const LogLevelChoices = [
  {
    description: 'Use environment settings',
    value: 'env',
  },
  ...map(LogLevels, (level) => ({
    description: level === 'http_out' ? 'http (egress)' : level,
    value: level,
  })),
];

const getBaseFormValues = (
  settings: SettingsStateInternal,
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
  server: systemSettings.server,
  logging: systemSettings.logging,
});

function getDefaultFormValues(
  settings: SettingsStateInternal,
  systemSettings: SystemSettings,
) {
  const base = getBaseFormValues(settings, systemSettings);
  base.logging.logRollConfig.maxFileSizeBytes ??= 0;
  base.logging.logRollConfig.schedule ??= {
    type: 'every',
    unit: 'day',
    increment: 0,
    offsetMs: 0,
  };
  return base;
}

export function GeneralSettingsForm({
  systemSettings,
}: GeneralSetingsFormProps) {
  const settings = useSettings();
  const snackbar = useSnackbar();
  const versionInfo = useVersion({
    retry: 0,
  });
  const theme = useTheme();
  const systemState = useSystemState();

  const { isLoading, isError } = versionInfo;

  const updateSystemSettings = useUpdateSystemSettings();

  const settingsForm = useForm<GeneralSettingsFormData>({
    defaultValues: getDefaultFormValues(settings, systemSettings),
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty, isValid, isSubmitting },
    watch,
  } = settingsForm;

  const { remove, append } = useFieldArray({
    control,
    name: 'backup.configurations',
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const [backupsValue] = watch(['backup']);
  const backupsEnabled = backupsValue.configurations.length > 0;

  const onSave = (data: GeneralSettingsFormData) => {
    const newBackendUri = trimEnd(trim(data.backendUri), '/');
    setBackendUri(newBackendUri);

    const rollSchedule =
      data.logging.logRollConfig.schedule?.type === 'every' &&
      data.logging.logRollConfig.schedule.increment >= 0
        ? data.logging.logRollConfig.schedule
        : undefined;
    const updateReq: UpdateSystemSettingsRequest = {
      logging: {
        logLevel: data.logLevel === 'env' ? undefined : data.logLevel,
        useEnvVarLevel: data.logLevel === 'env',
        logRollConfig: {
          ...data.logging.logRollConfig,
          maxFileSizeBytes: data.logging.logRollConfig.maxFileSizeBytes
            ? Math.max(0, data.logging.logRollConfig.maxFileSizeBytes)
            : undefined,
          schedule: rollSchedule,
        },
      },
      backup: data.backup,
      cache: data.cache,
      server: data.server,
    };

    updateSystemSettings.mutate(
      { body: updateReq },
      {
        onSuccess(data) {
          reset(getBaseFormValues(settings, data), { keepDirty: false });
          snackbar.enqueueSnackbar('Settings Saved!', {
            variant: 'success',
          });
        },
        onError: (err) => {
          console.error(err);
          snackbar.enqueueSnackbar(
            'Error while saving settings. Please check console for details.',
            {
              variant: 'error',
            },
          );
        },
      },
    );
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

  function renderBackupsForm() {
    return (
      <Grid container spacing={2}>
        <Grid size={{ xs: 12 }}>
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
            <FormHelperText>
              When enabling, Tunarr will generate an initial backup immediately
            </FormHelperText>
          </FormControl>
        </Grid>
        {backupsEnabled && <BackupForm />}
      </Grid>
    );
  }

  return (
    <Box component="form" onSubmit={handleSubmit(onSave, console.error)}>
      <FormProvider {...settingsForm}>
        <Stack gap={2} divider={<Divider />}>
          <Stack gap={2}>
            <Typography variant="h5" sx={{ mb: 1 }}>
              Server Settings
            </Typography>
            <Stack direction={{ sm: 'column', md: 'row' }} gap={2}>
              {!systemState.data.isInContainer && (
                <NumericFormControllerText
                  control={control}
                  name="server.port"
                  TextFieldProps={{
                    label: 'Server Listen Port',
                    fullWidth: true,
                    sx: {
                      width: { sm: '100%', md: '50%' },
                    },
                    helperText:
                      'Select the port the Tunarr server will listen on. This requires a server restart to take effect.',
                  }}
                />
              )}
              <Controller
                control={control}
                name="backendUri"
                rules={{ validate: { isValidUrl: (s) => isValidUrl(s, true) } }}
                render={({ field, fieldState: { error } }) => (
                  <TextField
                    sx={{
                      width: { sm: '100%', md: '50%' },
                    }}
                    fullWidth
                    label="Tunarr Backend URL"
                    slotProps={{
                      input: {
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
                      },
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
            </Stack>
          </Stack>
          <Stack gap={1}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Logging
            </Typography>
            <Box>
              <FormControl
                sx={{
                  width: ['100%', '50%'],
                }}
              >
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
                  instruct the server to use the <code>LOG_LEVEL</code>{' '}
                  environment variable, if set, or system default "info".
                </FormHelperText>
              </FormControl>
            </Box>
            <Box>
              <LogRollForm />
            </Box>
          </Stack>
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
              <FormControl
                sx={{
                  width: ['100%', '50%'],
                }}
              >
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
                  This feature is currently experimental. Proceed with caution
                  and if you experience an issue, try disabling caching.
                </FormHelperText>
              </FormControl>
            </Box>
          </Box>
        </Stack>
        <Stack
          spacing={2}
          direction="row"
          justifyContent="right"
          sx={{ mt: 2 }}
        >
          {isDirty && (
            <Button
              variant="outlined"
              onClick={() => {
                reset(getBaseFormValues(settings, systemSettings));
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
      </FormProvider>
    </Box>
  );
}
export type GeneralSettingsFormData = {
  backendUri: string;
  logLevel: LogLevel | 'env';
  backup: BackupSettings;
  cache: CacheSettings;
  server: ServerSettings;
  logging: LoggingSettings;
};

export type GeneralSetingsFormProps = {
  systemSettings: SystemSettings;
};
