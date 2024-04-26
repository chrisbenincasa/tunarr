import { CloudDoneOutlined, CloudOff } from '@mui/icons-material';
import {
  Box,
  Divider,
  InputAdornment,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { attempt, isEmpty, isError, trim, trimEnd } from 'lodash-es';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { RotatingLoopIcon } from '../../components/base/LoadingIcon.tsx';
import DarkModeButton from '../../components/settings/DarkModeButton.tsx';
import { useVersion } from '../../hooks/useVersion.ts';
import { setBackendUri } from '../../store/settings/actions.ts';
import { useSettings } from '../../store/settings/selectors.ts';

type GeneralSettingsForm = {
  backendUri: string;
};

function isValidUrl(url: string) {
  const sanitized = trim(url);
  return isEmpty(sanitized) || !isError(attempt(() => new URL(sanitized)));
}

export default function GeneralSettingsPage() {
  const settings = useSettings();
  const [snackStatus, setSnackStatus] = useState(false);
  const versionInfo = useVersion({
    retry: 0,
  });

  const { isLoading, isError } = versionInfo;

  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty, isValid, isSubmitting },
  } = useForm<GeneralSettingsForm>({
    reValidateMode: 'onBlur',
    defaultValues: settings,
  });

  const onSave = (data: GeneralSettingsForm) => {
    setBackendUri(trimEnd(trim(data.backendUri), '/'));
    setSnackStatus(true);
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
      <Stack direction="column" gap={2}>
        <Box>
          <Typography variant="h5" sx={{ mb: 2 }}>
            Theme Settings
          </Typography>
          <DarkModeButton />
        </Box>
        <Divider />
        <Box>
          <Typography variant="h5" sx={{ mb: 2 }}>
            Server Settings
          </Typography>
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
