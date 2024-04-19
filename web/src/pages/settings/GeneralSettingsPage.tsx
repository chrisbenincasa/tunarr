import Stack from '@mui/material/Stack';
import DarkModeButton from '../../components/settings/DarkModeButton.tsx';
import Button from '@mui/material/Button';
import { useSettings } from '../../store/settings/selectors.ts';
import { Controller, useForm } from 'react-hook-form';
import { attempt, isError } from 'lodash-es';
import { Box, Divider, Snackbar, TextField, Typography } from '@mui/material';
import { setBackendUri } from '../../store/settings/actions.ts';
import { useState } from 'react';

type GeneralSettingsForm = {
  backendUri: string;
};

function isValidUrl(url: string) {
  return !isError(attempt(() => new URL(url)));
}

export default function GeneralSettingsPage() {
  const settings = useSettings();
  const [snackStatus, setSnackStatus] = useState(false);

  const { control, handleSubmit } = useForm<GeneralSettingsForm>({
    reValidateMode: 'onBlur',
    defaultValues: settings,
  });

  const onSave = (data: GeneralSettingsForm) => {
    setBackendUri(data.backendUri);
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
                {...field}
                helperText={
                  error?.type === 'isValidUrl' ? 'Must use a valid URL' : ''
                }
              />
            )}
          />
        </Box>
      </Stack>
      <Stack spacing={2} direction="row" justifyContent="right" sx={{ mt: 2 }}>
        <Button variant="outlined">Reset Options</Button>
        <Button variant="contained" type="submit">
          Save
        </Button>
      </Stack>
    </Box>
  );
}
