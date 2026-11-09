import { useTypedAppFormContext } from '@/hooks/form.ts';
import { Trans, useLingui } from '@lingui/react/macro';
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
import { useQuery } from '@tanstack/react-query';
import { isNil } from 'lodash-es';
import { useCallback, useMemo, useState } from 'react';
import { getApiFfmpegInfoOptions } from '../../../generated/@tanstack/react-query.gen.ts';
import type { DropdownOption } from '../../../helpers/DropdownOption.ts';
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
    description: 'E-AC3',
    value: 'eac3',
  },
  {
    description: 'Opus (experimental)',
    value: 'libopus',
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
  const { t } = useLingui();
  const ffmpegInfo = useQuery({
    ...getApiFfmpegInfoOptions(),
  });
  const formOpts = useBaseTranscodeConfigFormOptions(initialConfig);
  const form = useTypedAppFormContext({ ...formOpts });
  const [loudnormEnabled, setLoudnormEnabled] = useState(
    !isNil(form.getFieldValue('audioLoudnormConfig')),
  );

  const audioFormatOptions = useMemo(() => {
    const availableEncoders = ffmpegInfo.data?.audioEncoders;

    return AudioFormats.map((option) => {
      if (option.value === 'copy') {
        return option;
      }

      const isSupported = availableEncoders?.find((encoder) => {
        return (
          encoder.ffmpegName === option.value ||
          // 'mp3' is an alias, the actual encoders in ffmpeg are called libmp3lame and libshine
          (option.value === 'mp3' &&
            encoder.name.includes(`(codec ${option.value})`))
        );
      });

      return {
        ...option,
        disabled: ffmpegInfo.isSuccess && !isSupported,
      };
    });
  }, [ffmpegInfo.data?.audioEncoders, ffmpegInfo.isSuccess]);

  const [fillerLevelsEnabled, setFillerLevelsEnabled] = useState(
    !isNil(form.getFieldValue('fillerAudioVolumePercent')) ||
      !isNil(form.getFieldValue('fillerAudioLoudnormConfig')),
  );
  const [fillerLoudnormEnabled, setFillerLoudnormEnabled] = useState(
    !isNil(form.getFieldValue('fillerAudioLoudnormConfig')),
  );

  const onFillerLevelsChange = useCallback(
    (enabled: boolean) => {
      setFillerLevelsEnabled(enabled);
      setFillerLoudnormEnabled(false);
      form.setFieldValue(
        'fillerAudioVolumePercent',
        enabled ? form.getFieldValue('audioVolumePercent') : null,
      );
      form.setFieldValue('fillerAudioLoudnormConfig', null);
    },
    [form],
  );

  const onFillerLoudnormChange = useCallback(
    (enabled: boolean) => {
      setFillerLoudnormEnabled(enabled);
      form.setFieldValue(
        'fillerAudioLoudnormConfig',
        enabled
          ? (form.getFieldValue('audioLoudnormConfig') ??
              LoudnormConfigSchema.decode({}))
          : null,
      );
    },
    [form],
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
        form.setFieldValue('audioLoudnormConfig', null);
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
                  label: t`Audio Format`,
                }}
                options={audioFormatOptions}
                helperText={
                  field.form.state.values.audioFormat === 'copy'
                    ? t`Passthrough audio unchanged. Other settings will not apply.`
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
                    label={t`Audio Bitrate`}
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
                        ? t`Bitrate cannot be changed when copying input audio`
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
                    label={t`Audio Buffer Size`}
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
                        ? t`Buffer size cannot be changed when copying input audio`
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
                    label={t`Audio Sample Rate`}
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
                        ? t`Sample rate cannot be changed when copying input audio`
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
              <field.BasicTextInput fullWidth label={t`Audio Channels`} />
            )}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <form.AppField
            name="audioVolumePercent"
            children={(field) => (
              <field.BasicTextInput
                fullWidth
                label={t`Audio Volume`}
                helperText={t`Adjust the output volume (not recommended). Values higher than 100 will boost the audio.`}
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
            <InputLabel>
              <Trans>Audio Loudness Normalization</Trans>
            </InputLabel>
            <Select
              label={t`Audio Loudness Normalization`}
              value={loudnormEnabled ? 'enabled' : 'disabled'}
              onChange={() => onLoudnormChange(!loudnormEnabled)}
            >
              <MenuItem value={'disabled'}>
                <Trans>Disabled</Trans>
              </MenuItem>
              <MenuItem value={'enabled'}>
                <Trans>Enabled (loudnorm)</Trans>
              </MenuItem>
            </Select>
            <FormHelperText>
              <Trans>
                Enable{' '}
                <Link
                  href="https://en.wikipedia.org/wiki/EBU_R_128"
                  target="_blank"
                >
                  EBU R 128
                </Link>{' '}
                loudness normalization via the <code>loudnorm</code> FFmpeg
                filter. May increase CPU usage during streaming.
              </Trans>
            </FormHelperText>
          </FormControl>
        </Grid>
      </Grid>
      <Stack spacing={2}>
        <Typography component="h6" variant="h6">
          <Trans>Filler Audio</Trans>
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <FormControl fullWidth>
              <InputLabel>
                <Trans>Filler Audio Levels</Trans>
              </InputLabel>
              <Select
                label={t`Filler Audio Levels`}
                value={fillerLevelsEnabled ? 'custom' : 'default'}
                onChange={() => onFillerLevelsChange(!fillerLevelsEnabled)}
              >
                <MenuItem value={'default'}>
                  <Trans>Default</Trans>
                </MenuItem>
                <MenuItem value={'custom'}>
                  <Trans>Custom</Trans>
                </MenuItem>
              </Select>
              <FormHelperText>
                <Trans>
                  Default uses the Audio Volume and Audio Loudness
                  Normalization settings above. Custom sets separate levels
                  for filler and channel fallback content.
                </Trans>
              </FormHelperText>
            </FormControl>
          </Grid>
          {fillerLevelsEnabled && (
            <>
              <Grid size={{ xs: 12, md: 6 }}>
                <form.AppField
                  name="fillerAudioVolumePercent"
                  children={(field) => (
                    <field.BasicTextInput
                      fullWidth
                      label={t`Filler Audio Volume`}
                      helperText={t`Has no effect while loudness normalization applies to filler. Set a lower filler loudness target instead.`}
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
                  <InputLabel>
                    <Trans>Filler Loudness Normalization</Trans>
                  </InputLabel>
                  <Select
                    label={t`Filler Loudness Normalization`}
                    value={fillerLoudnormEnabled ? 'custom' : 'default'}
                    onChange={() =>
                      onFillerLoudnormChange(!fillerLoudnormEnabled)
                    }
                  >
                    <MenuItem value={'default'}>
                      <Trans>Default</Trans>
                    </MenuItem>
                    <MenuItem value={'custom'}>
                      <Trans>Custom (loudnorm)</Trans>
                    </MenuItem>
                  </Select>
                  <FormHelperText>
                    <Trans>
                      Default uses the Audio Loudness Normalization setting
                      above.
                    </Trans>
                  </FormHelperText>
                </FormControl>
              </Grid>
            </>
          )}
        </Grid>
        {fillerLevelsEnabled && fillerLoudnormEnabled && (
          <Stack direction={{ sm: 'column', md: 'row' }} spacing={2}>
            <form.AppField
              name="fillerAudioLoudnormConfig.i"
              children={(field) => (
                <field.BasicTextInput
                  fullWidth
                  label={t`Filler Loudness Target`}
                  helperText="[-70.0, -5.0]"
                />
              )}
            />
            <form.AppField
              name="fillerAudioLoudnormConfig.lra"
              children={(field) => (
                <field.BasicTextInput
                  fullWidth
                  label={t`Filler Loudness Range Target`}
                  helperText="[1.0, 50.0]"
                />
              )}
            />
            <form.AppField
              name="fillerAudioLoudnormConfig.tp"
              children={(field) => (
                <field.BasicTextInput
                  fullWidth
                  label={t`Filler Max True Peak`}
                  helperText="[-9.0, 0.0]"
                />
              )}
            />
          </Stack>
        )}
      </Stack>
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
                  <Trans>Advanced Video Options</Trans>
                </Typography>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  <Trans>
                    Advanced options relating to audio. In general, do not
                    change these unless you know what you are doing!
                  </Trans>
                </Typography>
                {!!state.values.audioLoudnormConfig && (
                  <>
                    <Typography sx={{ mb: 1 }}>
                      <Trans>Loudnorm Options</Trans>
                    </Typography>
                    <Stack direction={{ sm: 'column', md: 'row' }} spacing={2}>
                      <form.AppField
                        name="audioLoudnormConfig.i"
                        children={(field) => (
                          <field.BasicTextInput
                            fullWidth
                            label={t`Loudness Target`}
                            helperText="[-70.0, -5.0]"
                          />
                        )}
                      />
                      <form.AppField
                        name="audioLoudnormConfig.lra"
                        children={(field) => (
                          <field.BasicTextInput
                            fullWidth
                            label={t`Loudness Range Target`}
                            helperText="[1.0, 50.0]"
                          />
                        )}
                      />
                      <form.AppField
                        name="audioLoudnormConfig.tp"
                        children={(field) => (
                          <field.BasicTextInput
                            fullWidth
                            label={t`Max True Peak`}
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
