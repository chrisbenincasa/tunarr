import { useSettings } from '@/store/settings/selectors.ts';
import {
  Box,
  Button,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Stack,
  TextField,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { XmlTvSettings } from '@tunarr/types';
import { defaultXmlTvSettings } from '@tunarr/types';
import { isEmpty, isEqual } from 'lodash-es';
import { useSnackbar } from 'notistack';
import { useEffect, useState } from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { Controller, useForm } from 'react-hook-form';
import UnsavedNavigationAlert from '../../components/settings/UnsavedNavigationAlert.tsx';
import {
  CheckboxFormController,
  NumericFormControllerText,
} from '../../components/util/TypedController.tsx';
import { putApiXmltvSettingsMutation } from '../../generated/@tanstack/react-query.gen.ts';
import { useXmlTvSettings } from '../../hooks/settingsHooks.ts';

export default function XmlTvSettingsPage() {
  const [restoreTunarrDefaults, setRestoreTunarrDefaults] = useState(false);
  const { backendUri } = useSettings();
  const { data, error } = useXmlTvSettings();
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
    ...putApiXmltvSettingsMutation(),
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
      body: {
        ...data,
      },
    });
  };

  // TODO: Handle this better - show the bug page.
  if (error) {
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
                <span>
                  You can edit this location in your settings.json within your
                  Tunarr data directory
                  <br />
                  <strong>NOTE:</strong> When manually adding the XMLTV location
                  to a client like Plex, do not use this file directly. Instead,
                  use the generated XMLTV from the Tunarr API endpoint:{' '}
                  {
                    new URL(
                      '/api/xmltv.xml',
                      isEmpty(backendUri) ? document.location.href : backendUri,
                    ).href
                  }
                </span>
              }
              {...field}
            />
          )}
        />
      </FormControl>
      <Stack spacing={2} direction={{ sm: 'column', md: 'row' }} sx={{ my: 2 }}>
        <NumericFormControllerText
          control={control}
          name="programmingHours"
          prettyFieldName="EPG (Hours)"
          TextFieldProps={{
            id: 'epg-hours',
            label: 'EPG (Hours)',
            helperText: 'Number of hours to include in the XMLTV file',
            sx: { mb: 2 },
          }}
        />
        <NumericFormControllerText
          control={control}
          name="refreshHours"
          prettyFieldName="Refresh Timer (Hours)"
          TextFieldProps={{
            id: 'refresh-hours',
            label: 'Refresh Timer (Hours)',
            helperText: 'How often the XMLTV file is regenerated',
          }}
        />
      </Stack>
      {/* <FormControl>
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
      </FormControl> */}
      <Divider sx={{ my: 2 }} />
      <FormControl>
        <FormControlLabel
          control={
            <CheckboxFormController control={control} name="useShowPoster" />
          }
          label="Use Show Poster"
        />
        <FormHelperText>
          If enabled, TV show episodes will use the poster of their show,
          instead of the individual episode poster.
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
          {!isEqual(defaultValues, {
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
