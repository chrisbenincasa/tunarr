import { useTypedAppFormContext } from '@/hooks/form.ts';
import {
  FormControl,
  FormHelperText,
  Grid,
  InputAdornment,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import {
  LoudnormConfigSchema,
  type SupportedTranscodeAudioOutputFormats,
} from '@tunarr/types/schemas';
import { isNil } from 'lodash-es';
import { useCallback, useState } from 'react';
import type { DropdownOption } from '../../../helpers/DropdownOption';
import type { BaseTranscodeConfigProps } from './BaseTranscodeConfigProps.ts';
import { useBaseTranscodeConfigFormOptions } from './useTranscodeConfigFormOptions.ts';

const AudioFormats: DropdownOption<SupportedTranscodeAudioOutputFormats>[] = [
  {
    description: 'AAC',
    value: 'aac',
  },
  {
    description: 'AC3',
    value: 'ac3',
  },
  {
    description: 'MP3',
    value: 'mp3',
  },
  {
    description: 'Copy / Passthrough',
    value: 'copy',
  },
] as const;

export const TranscodeConfigAudioSettingsForm = ({
  initialConfig,
  showAdvancedSettings,
}: BaseTranscodeConfigProps) => {
  const formOpts = useBaseTranscodeConfigFormOptions(initialConfig);
  const form = useTypedAppFormContext({ ...formOpts });
  const [loudnormEnabled, setLoudnormEnabled] = useState(
    !isNil(form.getFieldValue('audioLoudnormConfig')),
  );

  const onLoudnormChange = useCallback(
    (enabled: boolean) => {
      setLoudnormEnabled(enabled);
      if (enabled) {
        form.setFieldValue(
          'audioLoudnormConfig',
          LoudnormConfigSchema.decode({}),
        );
      } else {
        form.setFieldValue('audioLoudnormConfig', undefined);
      }
    },
    [form],
  );

  return (
    <Stack spacing={2}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12 }}>
          <form.AppField
            name="audioFormat"
            children={(field) => (
              <field.BasicSelectInput
                formControlProps={{ fullWidth: true }}
                selectProps={{
                  label: 'Audio Format',
                  disabled: field.form.state.values.audioFormat === 'copy',
                }}
                options={AudioFormats}
                helperText={
                  field.form.state.values.audioFormat === 'copy'
                    ? 'Passthrough audio unchanged. Other settings will not apply.'
                    : ''
                }
              />
            )}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <form.Subscribe
            selector={(s) => s.values.audioFormat}
            children={(encoder) => (
              <form.AppField
                name="audioBitRate"
                children={(field) => (
                  <field.BasicTextInput
                    fullWidth
                    label="Audio Bitrate"
                    disabled={encoder === 'copy'}
                    slotProps={{
                      input: {
                        endAdornment: (
                          <InputAdornment position="end">kbps</InputAdornment>
                        ),
                      },
                    }}
                    helperText={
                      encoder === 'copy'
                        ? 'Bitrate cannot be changed when copying input audio'
                        : null
                    }
                  />
                )}
              />
            )}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <form.Subscribe
            selector={(s) => s.values.audioFormat}
            children={(encoder) => (
              <form.AppField
                name="audioBufferSize"
                children={(field) => (
                  <field.BasicTextInput
                    fullWidth
                    label="Audio Buffer Size"
                    disabled={encoder === 'copy'}
                    slotProps={{
                      input: {
                        endAdornment: (
                          <InputAdornment position="end">kb</InputAdornment>
                        ),
                      },
                    }}
                    helperText={
                      encoder === 'copy'
                        ? 'Buffer size cannot be changed when copying input audio'
                        : null
                    }
                  />
                )}
              />
            )}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <form.Subscribe
            selector={(s) => s.values.audioFormat}
            children={(encoder) => (
              <form.AppField
                name="audioSampleRate"
                children={(field) => (
                  <field.BasicTextInput
                    fullWidth
                    label="Audio Sample Rate"
                    disabled={encoder === 'copy'}
                    slotProps={{
                      input: {
                        endAdornment: (
                          <InputAdornment position="end">kHz</InputAdornment>
                        ),
                      },
                    }}
                    helperText={
                      encoder === 'copy'
                        ? 'Sample rate cannot be changed when copying input audio'
                        : null
                    }
                  />
                )}
              />
            )}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <form.AppField
            name="audioChannels"
            children={(field) => (
              <field.BasicTextInput fullWidth label="Audio Channels" />
            )}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <form.AppField
            name="audioVolumePercent"
            children={(field) => (
              <field.BasicTextInput
                fullWidth
                label="Audio Volume"
                helperText={
                  'Adjust the output volume (not recommended). Values higher than 100 will boost the audio.'
                }
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">%</InputAdornment>
                    ),
                  },
                }}
              />
            )}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <FormControl fullWidth>
            <InputLabel>Audio Loudness Normalization</InputLabel>
            <Select
              label="Audio Loudness Normalization"
              value={loudnormEnabled ? 'enabled' : 'disabled'}
              onChange={() => onLoudnormChange(!loudnormEnabled)}
            >
              <MenuItem value={'disabled'}>Disabled</MenuItem>
              <MenuItem value={'enabled'}>Enabled (loudnorm)</MenuItem>
            </Select>
            <FormHelperText>
              Enable{' '}
              <Link
                href="https://en.wikipedia.org/wiki/EBU_R_128"
                target="_blank"
              >
                EBU R 128
              </Link>{' '}
              loudness normalization via the <code>loudnorm</code> FFmpeg
              filter. May increase CPU usage during streaming.
            </FormHelperText>
          </FormControl>
        </Grid>
      </Grid>
      {showAdvancedSettings && (
        <form.Subscribe
          children={(state) => {
            const hasOneAdvancedSetting = !!state.values.audioLoudnormConfig;
            if (!hasOneAdvancedSetting) {
              return null;
            }

            return (
              <Stack>
                <Typography component="h6" variant="h6" mb={1}>
                  Advanced Video Options
                </Typography>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Advanced options relating to audio. In general, do not change
                  these unless you know what you are doing!
                </Typography>
                {!!state.values.audioLoudnormConfig && (
                  <>
                    <Typography sx={{ mb: 1 }}>Loudnorm Options</Typography>
                    <Stack direction={{ sm: 'column', md: 'row' }} spacing={2}>
                      <form.AppField
                        name="audioLoudnormConfig.i"
                        children={(field) => (
                          <field.BasicTextInput
                            fullWidth
                            label="Loudness Target"
                            helperText="[-70.0, -5.0]"
                          />
                        )}
                      />
                      <form.AppField
                        name="audioLoudnormConfig.lra"
                        children={(field) => (
                          <field.BasicTextInput
                            fullWidth
                            label="Loudness Range Target"
                            helperText="[1.0, 50.0]"
                          />
                        )}
                      />
                      <form.AppField
                        name="audioLoudnormConfig.tp"
                        children={(field) => (
                          <field.BasicTextInput
                            fullWidth
                            label="Max True Peak"
                            helperText="[-9.0, 0.0]"
                          />
                        )}
                      />
                    </Stack>
                  </>
                )}
              </Stack>
            );
          }}
        />
      )}
    </Stack>
  );
};
