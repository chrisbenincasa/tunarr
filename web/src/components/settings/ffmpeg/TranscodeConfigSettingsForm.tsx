import {
  CheckboxFormController,
  NumericFormControllerText,
} from '@/components/util/TypedController';
import { isNonEmptyString } from '@/helpers/util';
import {
  Box,
  Button,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  Link as MuiLink,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { TranscodeConfig } from '@tunarr/types';
import { useSnackbar } from 'notistack';
import type { FieldErrors } from 'react-hook-form';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import Breadcrumbs from '../../Breadcrumbs.tsx';
import { TranscodeConfigAdvancedOptions } from './TranscodeConfigAdvancedOptions.tsx';
import { TranscodeConfigAudioSettingsForm } from './TranscodeConfigAudioSettingsForm.tsx';
import { TranscodeConfigErrorOptions } from './TranscodeConfigErrorOptions.tsx';
import { TranscodeConfigVideoSettingsForm } from './TranscodeConfigVideoSettingsForm.tsx';

type Props = {
  onSave: (config: TranscodeConfig) => Promise<TranscodeConfig>;
  initialConfig: TranscodeConfig;
  isNew?: boolean;
};

export const TranscodeConfigSettingsForm = ({
  onSave,
  initialConfig,
  isNew,
}: Props) => {
  const snackbar = useSnackbar();

  const transcodeConfigForm = useForm<TranscodeConfig>({
    defaultValues: initialConfig,
    mode: 'onChange',
  });
  const {
    control,
    reset,
    formState: { isSubmitting, isValid, isDirty },
    handleSubmit,
    watch,
  } = transcodeConfigForm;

  const hardwareAccelerationMode = watch('hardwareAccelerationMode');

  const saveForm = async (data: TranscodeConfig) => {
    try {
      const newConfig = await onSave(data);
      reset(newConfig);
      snackbar.enqueueSnackbar('Successfully saved config!', {
        variant: 'success',
      });
    } catch (e) {
      console.error(e);
      snackbar.enqueueSnackbar(
        'Error while saving transcode config. See console log for details.',
        {
          variant: 'error',
        },
      );
    }
  };

  const handleSubmitError = (errors: FieldErrors<TranscodeConfig>) => {
    console.error(errors);
  };

  return (
    <Box component="form" onSubmit={handleSubmit(saveForm, handleSubmitError)}>
      <Breadcrumbs />
      <FormProvider {...transcodeConfigForm}>
        <Stack spacing={2}>
          <Typography variant="h5">
            Edit Config: "{initialConfig.name}"
          </Typography>
          <Divider />
          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>
              General
            </Typography>
            <Grid container columnSpacing={2}>
              <Grid size={{ sm: 12, md: 6 }}>
                <Controller
                  control={control}
                  name="name"
                  rules={{
                    required: true,
                    minLength: 1,
                  }}
                  render={({ field, fieldState: { error } }) => (
                    <TextField
                      fullWidth
                      label="Name"
                      error={!!error}
                      helperText={
                        isNonEmptyString(error?.message)
                          ? error.message
                          : error?.type === 'required'
                            ? 'Name is required'
                            : error?.type === 'minLength'
                              ? 'Name is required'
                              : null
                      }
                      {...field}
                    />
                  )}
                />
              </Grid>
              <Grid size={{ sm: 12, md: 6 }}>
                <NumericFormControllerText
                  control={control}
                  name="threadCount"
                  prettyFieldName="Threads"
                  TextFieldProps={{
                    label: 'Threads',
                    fullWidth: true,
                    helperText: (
                      <>
                        Sets the number of threads used to decode the input
                        stream. Set to 0 to let ffmpeg automatically decide how
                        many threads to use. Read more about this option{' '}
                        <MuiLink
                          target="_blank"
                          href="https://ffmpeg.org/ffmpeg-codecs.html#:~:text=threads%20integer%20(decoding/encoding%2Cvideo)"
                        >
                          here
                        </MuiLink>
                      </>
                    ),
                  }}
                />
              </Grid>
              <Grid size={12}>
                <FormControl fullWidth>
                  <FormControlLabel
                    control={
                      <CheckboxFormController
                        control={control}
                        name="disableChannelOverlay"
                      />
                    }
                    label={'Disable Watermarks'}
                  />
                  <FormHelperText>
                    If set, all watermark overlays will be disabled for channels
                    assigned this transcode config.
                  </FormHelperText>
                </FormControl>
              </Grid>
            </Grid>
          </Box>
          <Divider />

          <Grid container spacing={2}>
            <Grid size={{ sm: 12, md: 6 }}>
              <Typography component="h6" variant="h6" sx={{ mb: 2 }}>
                Video Options
              </Typography>
              <TranscodeConfigVideoSettingsForm />
            </Grid>
            <Grid size={{ sm: 12, md: 6 }}>
              <Typography component="h6" variant="h6" sx={{ mb: 2 }}>
                Audio Options
              </Typography>
              <TranscodeConfigAudioSettingsForm />
            </Grid>
            <Grid size={12} sx={{ mt: 2 }}>
              <Divider />
            </Grid>
            {hardwareAccelerationMode !== 'none' && (
              <>
                <Grid size={{ sm: 12 }}>
                  <Typography component="h6" variant="h6" mb={1}>
                    Advanced Options
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    Advanced options relating to transcoding. In general, do not
                    change these unless you know what you are doing! These
                    settings exist in order to leave some parity with the old
                    dizqueTV transcode pipeline as well as to provide mechanisms
                    to aid in debugging streaming issues.
                  </Typography>
                  <TranscodeConfigAdvancedOptions />
                </Grid>
                <Grid size={12} sx={{ mt: 2 }}>
                  <Divider />
                </Grid>
              </>
            )}
            <Grid size={12}>
              <Typography component="h6" variant="h6" sx={{ pt: 2, pb: 1 }}>
                Error Options
              </Typography>
              <TranscodeConfigErrorOptions />
            </Grid>
          </Grid>
          <Stack spacing={2} direction="row" justifyContent="right">
            {(isDirty || (isDirty && !isSubmitting)) && (
              <Button
                variant="outlined"
                onClick={() => {
                  reset();
                }}
              >
                Reset Changes
              </Button>
            )}
            <Button
              variant="contained"
              disabled={!isValid || isSubmitting || (!isDirty && !isNew)}
              type="submit"
            >
              Save
            </Button>
          </Stack>
        </Stack>
      </FormProvider>
    </Box>
  );
};
