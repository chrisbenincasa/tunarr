import { useTypedAppFormContext } from '@/hooks/form.ts';
import { Trans, useLingui } from '@lingui/react/macro';
import { InputAdornment, Link as MuiLink, Stack } from '@mui/material';
import { useStore } from '@tanstack/react-form';
import { useSuspenseQuery } from '@tanstack/react-query';
import type {
  Resolution,
  SupportedTranscodeVideoOutputFormat,
} from '@tunarr/types';
import type { SupportedHardwareAccels } from '@tunarr/types/schemas';
import { useMemo } from 'react';
import { getApiFfmpegInfoOptions } from '../../../generated/@tanstack/react-query.gen.ts';
import { TranscodeResolutionOptions } from '../../../helpers/constants.ts';
import type { DropdownOption } from '../../../helpers/DropdownOption';
import {
  resolutionFromAnyString,
  resolutionToString,
} from '../../../helpers/util.ts';

import type { Converter } from '../../form/BasicSelectInput.tsx';
import type { BaseTranscodeConfigProps } from './BaseTranscodeConfigProps.ts';
import { useBaseTranscodeConfigFormOptions } from './useTranscodeConfigFormOptions.ts';

const VideoFormats: DropdownOption<SupportedTranscodeVideoOutputFormat>[] = [
  {
    description: 'H.264',
    value: 'h264',
  },
  {
    description: 'HEVC (H.265)',
    value: 'hevc',
  },
  {
    description: 'MPEG-2',
    value: 'mpeg2video',
  },
] as const;

const VideoHardwareAccelerationOptions: DropdownOption<SupportedHardwareAccels>[] =
  [
    {
      description: 'Software (no GPU)',
      value: 'none',
    },
    {
      description: 'Nvidia (CUDA)',
      value: 'cuda',
    },
    {
      description: 'Video Acceleration API (VA-API)',
      value: 'vaapi',
    },
    {
      description: 'Intel QuickSync',
      value: 'qsv',
    },
    {
      description: 'VideoToolbox',
      value: 'videotoolbox',
    },
  ] as const;

const resolutionConverter: Converter<Resolution, string> = {
  to: (res) => resolutionToString(res),
  from: (str) => resolutionFromAnyString(str)!,
};

export const TranscodeConfigVideoSettingsForm = ({
  initialConfig,
}: BaseTranscodeConfigProps) => {
  const { t } = useLingui();
  const ffmpegInfo = useSuspenseQuery({
    ...getApiFfmpegInfoOptions(),
  });

  const formOpts = useBaseTranscodeConfigFormOptions(initialConfig);
  const form = useTypedAppFormContext({ ...formOpts });

  const hardwareAccelerationMode = useStore(
    form.store,
    (state) => state.values.hardwareAccelerationMode,
  ); // watch('hardwareAccelerationMode');

  const hardwareAccelerationOptions = useMemo(() => {
    return VideoHardwareAccelerationOptions.filter(
      ({ value }) =>
        value === 'none' ||
        ffmpegInfo.data.hardwareAccelerationTypes.includes(value),
    );
  }, [ffmpegInfo.data.hardwareAccelerationTypes]);

  return (
    <Stack spacing={2}>
      <form.AppField
        name="videoFormat"
        children={(field) => (
          <field.BasicSelectInput
            selectProps={{ label: t`Video Format` }}
            options={VideoFormats}
          />
        )}
      />
      <form.AppField
        name="hardwareAccelerationMode"
        children={(field) => (
          <field.BasicSelectInput
            options={hardwareAccelerationOptions}
            selectProps={{ label: t`Hardware Acceleration` }}
          />
        )}
      />
      {/* <FormControl fullWidth>
        <InputLabel>Hardware Acceleration</InputLabel>
        <Controller
          control={control}
          name="hardwareAccelerationMode"
          render={({ field }) => (
            <Select label="Hardware Acceleration" {...field}>
              {VideoHardwareAccelerationOptions.filter(
                ({ value }) =>
                  value === 'none' ||
                  ffmpegInfo.data.hardwareAccelerationTypes.includes(value),
              ).map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.description}
                </MenuItem>
              ))}
            </Select>
          )}
        />
        <FormHelperText></FormHelperText>
      </FormControl> */}
      <form.Subscribe
        selector={(s) => s.values.hardwareAccelerationMode}
        children={(hwAccel) =>
          (hwAccel === 'qsv' || hwAccel === 'vaapi') && (
            <form.AppField
              name="vaapiDevice"
              children={(field) => (
                <field.BasicTextInput
                  fullWidth
                  label={hwAccel === 'qsv' ? t`QSV Device` : t`VA-API Device`}
                  helperText={
                    <Trans>
                      Override the default{' '}
                      {hardwareAccelerationMode === 'qsv' ? 'QSV' : 'VA-API'}{' '}
                      device path (defaults to <code>/dev/dri/renderD128</code>{' '}
                      on Linux and blank otherwise)
                    </Trans>
                  }
                />
              )}
            />
          )
        }
      />

      {/* {(hardwareAccelerationMode === 'vaapi' ||
        hardwareAccelerationMode === 'qsv') && (
        <Controller
          control={control}
          name="vaapiDevice"
          render={({ field }) => (
            <TextField
              fullWidth
              label={
                hardwareAccelerationMode === 'qsv'
                  ? 'QSV Device'
                  : 'VA-API Device'
              }
              helperText={
                <span>
                  Override the default{' '}
                  {hardwareAccelerationMode === 'qsv' ? 'QSV' : 'VA-API'} device
                  path (defaults to <code>/dev/dri/renderD128</code> on Linux
                  and blank otherwise)
                </span>
              }
              {...field}
            />
          )}
        />
      )} */}
      <form.AppField
        name="resolution"
        children={(field) => (
          <field.SelectInput
            options={TranscodeResolutionOptions}
            converter={resolutionConverter}
            selectProps={{ label: t`Resolution` }}
          />
        )}
      />

      <Stack direction={{ sm: 'column', md: 'row' }} spacing={2} useFlexGap>
        <form.AppField
          name="videoBitRate"
          children={(field) => (
            <field.BasicTextInput
              fullWidth
              label={t`Video Bitrate`}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">kbps</InputAdornment>
                  ),
                },
              }}
            />
          )}
        />
        <form.AppField
          name="videoBufferSize"
          children={(field) => (
            <field.BasicTextInput
              fullWidth
              label={t`Video Buffer Size`}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">kb</InputAdornment>
                  ),
                },
              }}
              helperText={
                <Trans>
                  Buffer size effects how frequently ffmpeg reconsiders the
                  output bitrate.{' '}
                  <MuiLink
                    target="_blank"
                    href="https://trac.ffmpeg.org/wiki/Limiting%20the%20output%20bitrate#Whatdoes-bufsizedo"
                  >
                    Read more
                  </MuiLink>
                </Trans>
              }
            />
          )}
        />
      </Stack>
      <Stack gap={1} direction={{ sm: 'column', md: 'row' }}>
        <form.AppField
          name="deinterlaceVideo"
          children={(field) => (
            <field.BasicCheckboxInput
              label={t`Auto Deinterlace Video`}
              formControlProps={{ fullWidth: true }}
              helperText={t`If set, all watermark overlays will be disabled for channels assigned this transcode config.`}
            />
          )}
        />
        <form.AppField
          name="normalizeFrameRate"
          children={(field) => (
            <field.BasicCheckboxInput
              label={t`Normalize Frame Rate`}
              formControlProps={{ fullWidth: true }}
              helperText={t`Output video at a constant frame rate.`}
            />
          )}
        />
      </Stack>
      {/* 
      <Stack gap={1} direction={{ sm: 'column', md: 'row' }}>
        <FormControl fullWidth>
          <FormControlLabel
            control={
              <CheckboxFormController
                control={control}
                name="deinterlaceVideo"
              />
            }
            label={'Auto Deinterlace Video'}
          />
          <FormHelperText> </FormHelperText>
        </FormControl>
        <FormControl fullWidth>
          <FormControlLabel
            control={
              <CheckboxFormController
                control={control}
                name="normalizeFrameRate"
              />
            }
            label={'Normalize Frame Rate'}
          />
          <FormHelperText>
            Output video at a constant frame rate.
          </FormHelperText>
        </FormControl>
      </Stack> */}
    </Stack>
  );
};
