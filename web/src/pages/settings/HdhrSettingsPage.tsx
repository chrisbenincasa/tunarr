import {
  Box,
  Button,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  Snackbar,
  Stack,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { HdhrSettings, defaultHdhrSettings } from '@tunarr/types';
import React, { useEffect } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import {
  CheckboxFormController,
  NumericFormControllerText,
} from '../../components/util/TypedController.tsx';
import { useHdhrSettings } from '../../hooks/settingsHooks.ts';

export default function HdhrSettingsPage() {
  const { data, isPending, error } = useHdhrSettings();

  const {
    reset,
    control,
    formState: { isDirty, isValid },
    handleSubmit,
  } = useForm<HdhrSettings>({
    defaultValues: defaultHdhrSettings,
    mode: 'onBlur',
  });

  useEffect(() => {
    if (data && !isDirty) {
      reset(data);
    }
  }, [data, isDirty, reset]);

  const [snackStatus, setSnackStatus] = React.useState<boolean>(false);
  const queryClient = useQueryClient();

  const updateHdhrSettingsMutation = useMutation({
    mutationFn: (updateSettings: HdhrSettings) => {
      return fetch('http://localhost:8000/api/hdhr-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateSettings),
      });
    },
    onSuccess: () => {
      setSnackStatus(true);
      return queryClient.invalidateQueries({
        queryKey: ['settings', 'hdhr-settings'],
      });
    },
  });

  const updateHdhrSettings: SubmitHandler<HdhrSettings> = (data) => {
    updateHdhrSettingsMutation.mutate({
      ...data,
    });
  };

  const handleSnackClose = () => {
    setSnackStatus(false);
  };

  if (isPending) {
    return <h1>XML: Loading...</h1>;
  } else if (error) {
    return <h1>XML: {error.message}</h1>;
  }

  return (
    <Box component="form" onSubmit={handleSubmit(updateHdhrSettings)}>
      <Snackbar
        open={snackStatus}
        autoHideDuration={6000}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        onClose={handleSnackClose}
        message="Settings Saved!"
      />
      <Grid item xs={12} sm={6}>
        <FormControl fullWidth>
          <FormControlLabel
            control={
              <CheckboxFormController
                control={control}
                name="autoDiscoveryEnabled"
              />
            }
            label="Enable SSDP server"
          />
          <FormHelperText>* Restart required</FormHelperText>
        </FormControl>
      </Grid>
      <NumericFormControllerText
        control={control}
        name="tunerCount"
        prettyFieldName="Tuner Count"
        TextFieldProps={{
          id: 'tuner-count',
          label: 'Tuner Count',
          fullWidth: true,
          variant: 'filled',
        }}
      />

      <Stack spacing={2} direction="row" justifyContent="right" sx={{ mt: 2 }}>
        <Button variant="outlined" onClick={() => reset()}>
          Reset Options
        </Button>
        <Button variant="contained" disabled={!isValid} type="submit">
          Save
        </Button>
      </Stack>
    </Box>
  );
}
