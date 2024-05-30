import { CloudDoneOutlined, CloudOff } from '@mui/icons-material';
import {
  Box,
  Divider,
  FormControl,
  FormHelperText,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { LogLevel, LogLevels, SystemSettings } from '@tunarr/types';
import { attempt, isEmpty, isError, map, trim, trimEnd } from 'lodash-es';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
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

type GeneralSettingsFormData = {
  backendUri: string;
  logLevel: LogLevel | 'env';
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

function isValidUrl(url: string) {
  const sanitized = trim(url);
  return isEmpty(sanitized) || !isError(attempt(() => new URL(sanitized)));
}

function GeneralSettingsForm({ systemSettings }: GeneralSetingsFormProps) {
  const settings = useSettings();
  const [snackStatus, setSnackStatus] = useState(false);
  const versionInfo = useVersion({
    retry: 0,
  });

  const { isLoading, isError } = versionInfo;

  const updateSystemSettings = useUpdateSystemSettings();

  const getBaseFormValues = (
    systemSettings: SystemSettings,
  ): GeneralSettingsFormData => ({
    backendUri: settings.backendUri,
    logLevel: systemSettings.logging.useEnvVarLevel
      ? 'env'
      : systemSettings.logging.logLevel,
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty, isValid, isSubmitting },
  } = useForm<GeneralSettingsFormData>({
    reValidateMode: 'onBlur',
    defaultValues: getBaseFormValues(systemSettings),
  });

  const onSave = (data: GeneralSettingsFormData) => {
    const newBackendUri = trimEnd(trim(data.backendUri), '/');
    setBackendUri(newBackendUri);
    setSnackStatus(true);
    const updateReq: UpdateSystemSettingsRequest = {
      logLevel: data.logLevel === 'env' ? undefined : data.logLevel,
      useEnvVarLevel: data.logLevel === 'env',
    };
    updateSystemSettings.mutate(updateReq, {
      onSuccess(data) {
        reset(getBaseFormValues(data), { keepDirty: false });
      },
    });
  };

  return (
    <Box component="form" onSubmit={handleSubmit(onSave, console.error)}>
      <Snackbar
        open={snackStatus}
        autoHideDuration={6000}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        onClose={() => setSnackStatus(false)}
        message="Settings Saved!"
      />
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
                    <MenuItem value={value}>{description}</MenuItem>
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
