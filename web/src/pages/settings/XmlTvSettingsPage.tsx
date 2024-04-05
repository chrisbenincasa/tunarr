import {
  Box,
  Button,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Snackbar,
  Stack,
  TextField,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { XmlTvSettings, defaultXmlTvSettings } from '@tunarr/types';
import React, { useEffect } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import {
  CheckboxFormController,
  NumericFormControllerText,
} from '../../components/util/TypedController.tsx';
import { useXmlTvSettings } from '../../hooks/settingsHooks.ts';

export default function XmlTvSettingsPage() {
  const { data, isPending, error } = useXmlTvSettings();

  const {
    reset,
    control,
    formState: { isDirty, isValid },
    handleSubmit,
  } = useForm<XmlTvSettings>({
    defaultValues: defaultXmlTvSettings,
    mode: 'onBlur',
  });

  useEffect(() => {
    if (data && !isDirty) {
      reset(data);
    }
  }, [data, isDirty, reset]);

  const [snackStatus, setSnackStatus] = React.useState<boolean>(false);
  const queryClient = useQueryClient();

  const updateXmlTvSettingsMutation = useMutation({
    mutationFn: (updateSettings: XmlTvSettings) => {
      return fetch('http://localhost:8000/api/xmltv-settings', {
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
        queryKey: ['settings', 'xmltv-settings'],
      });
    },
  });

  const updateXmlTvSettings: SubmitHandler<XmlTvSettings> = (data) => {
    updateXmlTvSettingsMutation.mutate({
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
    <Box component="form" onSubmit={handleSubmit(updateXmlTvSettings)}>
      <Snackbar
        open={snackStatus}
        autoHideDuration={6000}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        onClose={handleSnackClose}
        message="Settings Saved!"
      />
      <FormControl fullWidth>
        <Controller
          control={control}
          name="outputPath"
          render={({ field }) => (
            <TextField
              id="output-path"
              label="Output Path"
              helperText={
                'You can edit this location in file xmltv-settings.json.'
              }
              {...field}
            />
          )}
        />
      </FormControl>
      <Stack spacing={2} direction={{ sm: 'column', md: 'row' }}>
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
