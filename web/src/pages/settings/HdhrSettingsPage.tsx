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
import _ from 'lodash-es';
import React, { useEffect } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import UnsavedNavigationAlert from '../../components/settings/UnsavedNavigationAlert.tsx';
import {
  CheckboxFormController,
  NumericFormControllerText,
} from '../../components/util/TypedController.tsx';
import { useHdhrSettings } from '../../hooks/settingsHooks.ts';
import { useTunarrApi } from '../../hooks/useTunarrApi.ts';

export default function HdhrSettingsPage() {
  const apiClient = useTunarrApi();
  const [restoreTunarrDefaults, setRestoreTunarrDefaults] =
    React.useState<boolean>(false);

  const { data, isPending, error } = useHdhrSettings();

  const {
    reset,
    control,
    formState: { isDirty, isValid, isSubmitting, defaultValues },
    handleSubmit,
  } = useForm<HdhrSettings>({
    defaultValues: defaultHdhrSettings,
    mode: 'onBlur',
  });

  useEffect(() => {
    if (data) {
      reset(data);
    }
  }, [data, reset]);

  const [snackStatus, setSnackStatus] = React.useState<boolean>(false);
  const queryClient = useQueryClient();

  const updateHdhrSettingsMutation = useMutation({
    mutationFn: apiClient.updateHdhrSettings,
    onSuccess: (data) => {
      setSnackStatus(true);
      setRestoreTunarrDefaults(false);
      reset(data, { keepValues: true });
      return queryClient.invalidateQueries({
        queryKey: ['settings', 'hdhr-settings'],
      });
    },
  });

  const updateHdhrSettings: SubmitHandler<HdhrSettings> = (
    data: HdhrSettings,
  ) => {
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
      <UnsavedNavigationAlert isDirty={isDirty} />
      <Stack spacing={2} direction="row" sx={{ mt: 2 }}>
        <Stack
          spacing={2}
          direction="row"
          justifyContent="left"
          sx={{ mt: 2, flexGrow: 1 }}
        >
          {!_.isEqual(defaultValues, defaultHdhrSettings) && (
            <Button
              variant="outlined"
              onClick={() => {
                reset(defaultHdhrSettings);
                setRestoreTunarrDefaults(true);
              }}
            >
              Restore Default Settings
            </Button>
          )}
        </Stack>
        <Stack spacing={2} direction="row" justifyContent="right">
          {isDirty && (
            <Button
              variant="outlined"
              onClick={() => {
                reset(data);
                setRestoreTunarrDefaults(false);
              }}
            >
              Reset Changes
            </Button>
          )}
          <Button
            variant="contained"
            disabled={
              !isValid || isSubmitting || (!isDirty && !restoreTunarrDefaults)
            }
            type="submit"
          >
            Save
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
