import { useAppForm } from '@/hooks/form.ts';
import { Check } from '@mui/icons-material';
import {
  Box,
  Button,
  Checkbox,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  Link as MuiLink,
  Stack,
  TextField,
  ToggleButton,
  Typography,
} from '@mui/material';
import type { TranscodeConfig } from '@tunarr/types';
import type { TranscodeConfigSchema } from '@tunarr/types/schemas';
import type z from 'zod';
import useStore from '../../../store/index.ts';
import { setShowAdvancedSettings } from '../../../store/settings/actions.ts';
import Breadcrumbs from '../../Breadcrumbs.tsx';
import { TranscodeConfigAdvancedOptions } from './TranscodeConfigAdvancedOptions.tsx';
import { TranscodeConfigAudioSettingsForm } from './TranscodeConfigAudioSettingsForm.tsx';
import { TranscodeConfigErrorOptions } from './TranscodeConfigErrorOptions.tsx';
import { TranscodeConfigVideoSettingsForm } from './TranscodeConfigVideoSettingsForm.tsx';
import { useTranscodeConfigFormOptions } from './useTranscodeConfigFormOptions.ts';

type Props = {
  initialConfig: z.input<typeof TranscodeConfigSchema>;
  isNew?: boolean;
};

export const TranscodeConfigSettingsForm = ({
  initialConfig,
  isNew,
}: Props) => {
  const showAdvancedSettings = useStore(
    (s) => s.settings.ui.showAdvancedSettings,
  );

  const saveForm = (newConfig: TranscodeConfig) => {
    transcodeConfigForm.reset(newConfig, { keepDefaultValues: true });
  };

  const formOpts = useTranscodeConfigFormOptions({
    initialConfig,
    isNew,
    onSave: saveForm,
  });
  const transcodeConfigForm = useAppForm({ ...formOpts });

  return (
    <Box
      component="form"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        transcodeConfigForm.handleSubmit().catch(console.error);
      }}
    >
      <Breadcrumbs />
      <transcodeConfigForm.AppForm>
        <Stack spacing={2} divider={<Divider />}>
          <Stack direction={'row'}>
            <Typography variant="h4">
              Edit Transcode Config: "{initialConfig.name}"
            </Typography>
            <ToggleButton
              value={showAdvancedSettings}
              selected={showAdvancedSettings}
              onChange={() => setShowAdvancedSettings(!showAdvancedSettings)}
              sx={{ ml: 'auto' }}
            >
              <Check sx={{ mr: 0.5 }} /> Show Advanced
            </ToggleButton>
          </Stack>
          <Box>
            <Typography variant="h5" sx={{ mb: 2 }}>
              General
            </Typography>
            <Grid container columnSpacing={2}>
              <Grid size={{ sm: 12, md: 6 }}>
                <transcodeConfigForm.AppField
                  name="name"
                  children={(field) => (
                    <field.BasicTextInput fullWidth label="Name" />
                  )}
                />
                {/* <Controller
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
                /> */}
              </Grid>
              <Grid size={{ sm: 12, md: 6 }}>
                <transcodeConfigForm.Field
                  name="threadCount"
                  children={(field) => (
                    <TextField
                      label="Threads"
                      fullWidth
                      helperText={
                        <>
                          Sets the number of threads used to decode the input
                          stream. Set to 0 to let ffmpeg automatically decide
                          how many threads to use. Read more about this option{' '}
                          <MuiLink
                            target="_blank"
                            href="https://ffmpeg.org/ffmpeg-codecs.html#:~:text=threads%20integer%20(decoding/encoding%2Cvideo)"
                          >
                            here
                          </MuiLink>
                          . <strong>Note: </strong> this option is overridden to
                          1 when using hardware accelearation for stability
                          reasons.
                        </>
                      }
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  )}
                />
                {/* <NumericFormControllerText
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
                        . <strong>Note: </strong> this option is overridden to 1
                        when using hardware accelearation for stability reasons.
                      </>
                    ),
                  }}
                /> */}
              </Grid>
              <Grid size={12}>
                <FormControl fullWidth>
                  <FormControlLabel
                    control={
                      <transcodeConfigForm.Field
                        name="disableChannelOverlay"
                        children={(field) => (
                          <Checkbox
                            // {...field}
                            value={field.state.value}
                            checked={field.state.value}
                            onChange={(_, checked) =>
                              field.handleChange(checked)
                            }
                          />
                        )}
                      />

                      // <CheckboxFormController
                      //   control={control}
                      //   name="disableChannelOverlay"
                      // />
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

          <Box>
            <Typography component="h5" variant="h5" sx={{ mb: 2 }}>
              Video Options
            </Typography>
            <TranscodeConfigVideoSettingsForm initialConfig={initialConfig} />
            <transcodeConfigForm.Subscribe
              selector={(s) => s.values.hardwareAccelerationMode}
              children={(hardwareAccelerationMode) =>
                showAdvancedSettings &&
                hardwareAccelerationMode !== 'none' && (
                  <Box>
                    <Typography component="h6" variant="h6" mb={1}>
                      Advanced Video Options
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                      Advanced options relating to transcoding. In general, do
                      not change these unless you know what you are doing! These
                      settings exist in order to leave some parity with the old
                      dizqueTV transcode pipeline as well as to provide
                      mechanisms to aid in debugging streaming issues.
                    </Typography>
                    <TranscodeConfigAdvancedOptions />
                  </Box>
                )
              }
            />
          </Box>
          <Box>
            <Typography component="h5" variant="h5" sx={{ mb: 2 }}>
              Audio Options
            </Typography>
            <TranscodeConfigAudioSettingsForm
              initialConfig={initialConfig}
              showAdvancedSettings={showAdvancedSettings}
            />
          </Box>
          <Box>
            <Typography component="h6" variant="h6" sx={{ pb: 1 }}>
              Error Options
            </Typography>
            <TranscodeConfigErrorOptions initialConfig={initialConfig} />
          </Box>

          <Stack spacing={2} direction="row" justifyContent="right">
            <transcodeConfigForm.Subscribe
              selector={(state) => state}
              children={({ isPristine, canSubmit, isSubmitting }) => (
                <>
                  {!isPristine ? (
                    <Button
                      variant="outlined"
                      onClick={() => {
                        transcodeConfigForm.reset();
                      }}
                    >
                      Reset Changes
                    </Button>
                  ) : null}
                  <Button
                    variant="contained"
                    disabled={!canSubmit}
                    type="submit"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit'}
                  </Button>
                </>
              )}
            />
          </Stack>
        </Stack>
      </transcodeConfigForm.AppForm>
    </Box>
  );
};
