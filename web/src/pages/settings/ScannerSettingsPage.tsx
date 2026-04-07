import { NumericFormControllerText } from '@/components/util/TypedController.tsx';
import {
  getApiSettingsMediaSourceOptions,
  putApiSettingsMediaSourceMutation,
} from '@/generated/@tanstack/react-query.gen.ts';
import { Box, Button, Stack } from '@mui/material';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import type { GlobalMediaSourceSettings } from '@tunarr/types/schemas';
import { useSnackbar } from 'notistack';
import { useCallback } from 'react';
import { useForm } from 'react-hook-form';

export const ScannerSettingsPage = () => {
  const { data: mediaSourceSettings } = useSuspenseQuery(
    getApiSettingsMediaSourceOptions(),
  );

  const settingsForm = useForm<GlobalMediaSourceSettings>({
    defaultValues: mediaSourceSettings,
  });

  const snackbar = useSnackbar();

  const updateMediaSourceSettingsMut = useMutation({
    ...putApiSettingsMediaSourceMutation(),
    onSuccess: (returned) => {
      settingsForm.reset(returned);
      snackbar.enqueueSnackbar({
        variant: 'success',
        message: 'Successfully updated Media Source settings.',
      });
    },
    onError: (err) => {
      console.error(err);
      snackbar.enqueueSnackbar({
        variant: 'error',
        message:
          'Failed to update Media Source settings. Please check server and browser logs for details.',
      });
    },
  });

  const onSubmit = useCallback(
    (data: GlobalMediaSourceSettings) => {
      updateMediaSourceSettingsMut.mutate({
        body: data,
      });
    },
    [updateMediaSourceSettingsMut],
  );

  const onError = useCallback(() => {
    snackbar.enqueueSnackbar({
      variant: 'error',
      message:
        'There was an error submitting the request to update Media Source settings. Please check the form and try again',
    });
  }, [snackbar]);

  return (
    <Stack>
      <Box
        component="form"
        onSubmit={settingsForm.handleSubmit(onSubmit, onError)}
      >
        <Stack gap={2}>
          <NumericFormControllerText
            control={settingsForm.control}
            name="rescanIntervalHours"
            prettyFieldName="Rescan Interval (hours)"
            TextFieldProps={{
              label: 'Rescan Interval (hours)',
              helperText:
                'How frequently libraries should be scanned (starting from midnight).',
            }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="submit"
              variant="contained"
              disabled={!settingsForm.formState.isDirty}
            >
              Save
            </Button>
          </Box>
        </Stack>
      </Box>
    </Stack>
  );
};
