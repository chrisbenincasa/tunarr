import {
  Box,
  Button,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  Stack,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { HdhrSettings } from '@tunarr/types';
import { defaultHdhrSettings } from '@tunarr/types';
import { isEqual } from 'lodash-es';
import { useSnackbar } from 'notistack';
import React, { useEffect } from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import UnsavedNavigationAlert from '../../components/settings/UnsavedNavigationAlert.tsx';
import {
  CheckboxFormController,
  NumericFormControllerText,
} from '../../components/util/TypedController.tsx';
import {
  getApiHdhrSettingsQueryKey,
  putApiHdhrSettingsMutation,
} from '../../generated/@tanstack/react-query.gen.ts';
import { useHdhrSettings } from '../../hooks/settingsHooks.ts';

export default function HdhrSettingsPage() {
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

  const snackbar = useSnackbar();
  const queryClient = useQueryClient();

  const updateHdhrSettingsMutation = useMutation({
    ...putApiHdhrSettingsMutation(),
    onSuccess: (data) => {
      snackbar.enqueueSnackbar('Settings Saved!', {
        variant: 'success',
      });
      setRestoreTunarrDefaults(false);
      reset(data, { keepValues: true });
      return queryClient.invalidateQueries({
        queryKey: getApiHdhrSettingsQueryKey(),
      });
    },
  });

  const updateHdhrSettings: SubmitHandler<HdhrSettings> = (
    data: HdhrSettings,
  ) => {
    updateHdhrSettingsMutation.mutate({
      body: {
        ...data,
      },
    });
  };

  if (isPending) {
    return <h1>HDHR: Loading...</h1>;
  } else if (error) {
    return <h1>HDHR: {error.message}</h1>;
  }

  return (
    <Box component="form" onSubmit={handleSubmit(updateHdhrSettings)}>
      <Grid size={{ xs: 12, sm: 6 }}>
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
          {!isEqual(defaultValues, defaultHdhrSettings) && (
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
