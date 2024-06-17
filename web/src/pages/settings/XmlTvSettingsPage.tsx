import {
  Box,
  Button,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Stack,
  TextField,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { XmlTvSettings, defaultXmlTvSettings } from '@tunarr/types';
import _ from 'lodash-es';
import React, { useEffect } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import UnsavedNavigationAlert from '../../components/settings/UnsavedNavigationAlert.tsx';
import {
  CheckboxFormController,
  NumericFormControllerText,
} from '../../components/util/TypedController.tsx';
import { useXmlTvSettings } from '../../hooks/settingsHooks.ts';
import { useTunarrApi } from '../../hooks/useTunarrApi.ts';
import { useSnackbar } from 'notistack';

export default function XmlTvSettingsPage() {
  const apiClient = useTunarrApi();
  const [restoreTunarrDefaults, setRestoreTunarrDefaults] =
    React.useState<boolean>(false);
  const { data, isPending, error } = useXmlTvSettings();
  const snackbar = useSnackbar();

  const {
    reset,
    control,
    formState: { isDirty, isValid, isSubmitting, defaultValues },
    handleSubmit,
  } = useForm<XmlTvSettings>({
    defaultValues: defaultXmlTvSettings,
    mode: 'onBlur',
  });

  useEffect(() => {
    if (data) {
      reset(data);
    }
  }, [data, reset]);

  const queryClient = useQueryClient();

  const updateXmlTvSettingsMutation = useMutation({
    mutationFn: apiClient.updateXmlTvSettings,
    onSuccess: (data) => {
      snackbar.enqueueSnackbar('Settings Saved!', {
        variant: 'success',
      });
      setRestoreTunarrDefaults(false);
      reset(data, { keepValues: true });
      return queryClient.invalidateQueries({
        queryKey: ['settings', 'xmltv-settings'],
      });
    },
  });

  const updateXmlTvSettings: SubmitHandler<XmlTvSettings> = (data) => {
    updateXmlTvSettingsMutation.mutate({
      ...data,
    });
  };

  if (isPending) {
    return <h1>XML: Loading...</h1>;
  } else if (error) {
    return <h1>XML: {error.message}</h1>;
  }

  return (
    <Box component="form" onSubmit={handleSubmit(updateXmlTvSettings)}>
      <FormControl fullWidth>
        <Controller
          control={control}
          name="outputPath"
          render={({ field }) => (
            <TextField
              id="output-path"
              label="Output Path"
              InputProps={{
                readOnly: true,
                disabled: true,
              }}
              helperText={
                'You can edit this location in file xmltv-settings.json.'
              }
              {...field}
            />
          )}
        />
      </FormControl>
      <Stack spacing={2} direction={{ sm: 'column', md: 'row' }} sx={{ mt: 2 }}>
        <NumericFormControllerText
          control={control}
          name="programmingHours"
          prettyFieldName="EPG (Hours)"
          TextFieldProps={{
            id: 'epg-hours',
            label: 'EPG (Hours)',
            helperText:
              'How many hours of programming to include in the xmltv file.',
          }}
        />
        <NumericFormControllerText
          control={control}
          name="refreshHours"
          prettyFieldName="Refresh Timer (Hours)"
          TextFieldProps={{
            id: 'refresh-hours',
            label: 'Refresh Timer (Hours)',
            helperText: 'How often should the xmltv file be updated.',
          }}
        />
      </Stack>
      <FormControl>
        <FormControlLabel
          control={
            <CheckboxFormController control={control} name="enableImageCache" />
          }
          label="Image Cache"
        />
        <FormHelperText>
          If enabled the pictures used for Movie and TV Show posters will be
          cached in Tunarr's .tunarr folder and will be delivered by Tunarr's
          server instead of requiring calls to Plex. Note that using fixed xmltv
          location in Plex (as opposed to url) will not work correctly in this
          case.
        </FormHelperText>
      </FormControl>
      <UnsavedNavigationAlert isDirty={isDirty} />
      <Stack spacing={2} direction="row" sx={{ mt: 2 }}>
        <Stack
          spacing={2}
          direction="row"
          justifyContent="left"
          sx={{ mt: 2, flexGrow: 1 }}
        >
          {!_.isEqual(defaultValues, {
            ...defaultXmlTvSettings,
            outputPath: data.outputPath,
          }) && (
            <Button
              variant="outlined"
              onClick={() => {
                reset({ ...defaultXmlTvSettings, outputPath: data.outputPath });
                setRestoreTunarrDefaults(true);
              }}
            >
              Restore Default Settings
            </Button>
          )}
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
