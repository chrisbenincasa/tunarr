import { useAppForm } from '@/hooks/form.ts';
import { Trans, useLingui } from '@lingui/react/macro';
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
  Typography,
} from '@mui/material';
import type { TranscodeConfig } from '@tunarr/types';
import type { TranscodeConfigSchema } from '@tunarr/types/schemas';
import type z from 'zod';
import useStore from '../../../store/index.ts';
import UnsavedNavigationAlert from '../UnsavedNavigationAlert.tsx';
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
  const { t } = useLingui();
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
      <transcodeConfigForm.AppForm>
        <Stack spacing={2} divider={<Divider />}>
          <Box>
            <Typography variant="h5" sx={{ mb: 2 }}>
              <Trans>General</Trans>
            </Typography>
            <Grid container columnSpacing={2}>
              <Grid size={{ sm: 12, md: 6 }}>
                <transcodeConfigForm.AppField
                  name="name"
                  children={(field) => (
                    <field.BasicTextInput fullWidth label={t`Name`} />
                  )}
                />
              </Grid>
              <Grid size={{ sm: 12, md: 6 }}>
                <transcodeConfigForm.Field
                  name="threadCount"
                  children={(field) => (
                    <TextField
                      label={t`Threads`}
                      fullWidth
                      helperText={
                        <Trans>
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
                        </Trans>
                      }
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  )}
                />
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
                    }
                    label={t`Disable Watermarks`}
                  />
                  <FormHelperText>
                    <Trans>
                      If set, all watermark overlays will be disabled for
                      channels assigned this transcode config.
                    </Trans>
                  </FormHelperText>
                </FormControl>
              </Grid>
            </Grid>
          </Box>

          <Stack spacing={2}>
            <Typography component="h5" variant="h5">
              <Trans>Video Options</Trans>
            </Typography>
            <TranscodeConfigVideoSettingsForm initialConfig={initialConfig} />
            <transcodeConfigForm.Subscribe
              selector={(s) => s.values.hardwareAccelerationMode}
              children={(hardwareAccelerationMode) =>
                showAdvancedSettings &&
                hardwareAccelerationMode !== 'none' && (
                  <Box>
                    <Typography component="h6" variant="h6" mb={1}>
                      <Trans>Advanced Video Options</Trans>
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                      <Trans>
                        Advanced options relating to transcoding. In general, do
                        not change these unless you know what you are doing!
                        These settings exist in order to leave some parity with
                        the old dizqueTV transcode pipeline as well as to
                        provide mechanisms to aid in debugging streaming issues.
                      </Trans>
                    </Typography>
                    <TranscodeConfigAdvancedOptions
                      initialConfig={initialConfig}
                    />
                  </Box>
                )
              }
            />
          </Stack>
          <Box>
            <Typography component="h5" variant="h5" sx={{ mb: 2 }}>
              <Trans>Audio Options</Trans>
            </Typography>
            <TranscodeConfigAudioSettingsForm
              initialConfig={initialConfig}
              showAdvancedSettings={showAdvancedSettings}
            />
          </Box>
          <Box>
            <Typography component="h6" variant="h6" sx={{ pb: 1 }}>
              <Trans>Error Options</Trans>
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
                      <Trans>Reset Changes</Trans>
                    </Button>
                  ) : null}
                  <Button
                    variant="contained"
                    disabled={isPristine || !canSubmit}
                    type="submit"
                  >
                    {isSubmitting ? (
                      <Trans>Saving...</Trans>
                    ) : (
                      <Trans>Save</Trans>
                    )}
                  </Button>
                  <UnsavedNavigationAlert isDirty={!isPristine} />
                </>
              )}
            />
          </Stack>
        </Stack>
      </transcodeConfigForm.AppForm>
    </Box>
  );
};
