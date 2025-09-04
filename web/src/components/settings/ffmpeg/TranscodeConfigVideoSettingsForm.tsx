import type { SelectChangeEvent } from '@mui/material';
import {
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputAdornment,
  InputLabel,
  MenuItem,
  Link as MuiLink,
  Select,
  Stack,
  TextField,
} from '@mui/material';
import { useSuspenseQuery } from '@tanstack/react-query';
import type {
  SupportedTranscodeVideoOutputFormat,
  TranscodeConfig,
} from '@tunarr/types';
import type { SupportedHardwareAccels } from '@tunarr/types/schemas';
import { Controller, useFormContext } from 'react-hook-form';
import { getApiFfmpegInfoOptions } from '../../../generated/@tanstack/react-query.gen.ts';
import { TranscodeResolutionOptions } from '../../../helpers/constants.ts';
import type { DropdownOption } from '../../../helpers/DropdownOption';
import {
  resolutionFromAnyString,
  resolutionToString,
} from '../../../helpers/util.ts';
import {
  CheckboxFormController,
  NumericFormControllerText,
  TypedController,
} from '../../util/TypedController.tsx';

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

export const TranscodeConfigVideoSettingsForm = () => {
  const ffmpegInfo = useSuspenseQuery({
    ...getApiFfmpegInfoOptions(),
  });

  const { control, watch } = useFormContext<TranscodeConfig>();

  const hardwareAccelerationMode = watch('hardwareAccelerationMode');

  return (
    <Stack gap={2}>
      <FormControl fullWidth>
        <InputLabel>Video Format</InputLabel>
        <Controller
          control={control}
          name="videoFormat"
          render={({ field }) => (
            <Select label="Video Format" {...field}>
              {VideoFormats.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.description}
                </MenuItem>
              ))}
            </Select>
          )}
        />
        <FormHelperText></FormHelperText>
      </FormControl>
      <FormControl fullWidth>
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
      </FormControl>

      {(hardwareAccelerationMode === 'vaapi' ||
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
      )}

      <FormControl fullWidth>
        <InputLabel id="target-resolution-label">Resolution</InputLabel>
        <TypedController
          control={control}
          name="resolution"
          toFormType={resolutionFromAnyString}
          valueExtractor={(e) => (e as SelectChangeEvent).target.value}
          render={({ field }) => (
            <Select
              labelId="target-resolution-label"
              id="target-resolution"
              label="Resolution"
              {...field}
              value={resolutionToString(field.value)}
            >
              {TranscodeResolutionOptions.map((resolution) => (
                <MenuItem key={resolution.value} value={resolution.value}>
                  {resolution.label}
                </MenuItem>
              ))}
            </Select>
          )}
        />
      </FormControl>

      <Stack direction={{ sm: 'column', md: 'row' }} gap={2} useFlexGap>
        <NumericFormControllerText
          control={control}
          name="videoBitRate"
          prettyFieldName="Video Bitrate"
          TextFieldProps={{
            id: 'video-bitrate',
            label: 'Video Bitrate',
            fullWidth: true,
            sx: { my: 1 },
            InputProps: {
              endAdornment: (
                <InputAdornment position="end">kbps</InputAdornment>
              ),
            },
          }}
        />
        <NumericFormControllerText
          control={control}
          name="videoBufferSize"
          prettyFieldName="Video Buffer Size"
          TextFieldProps={{
            id: 'video-buffer-size',
            label: 'Video Buffer Size',
            fullWidth: true,
            sx: { my: 1 },
            InputProps: {
              endAdornment: <InputAdornment position="end">kb</InputAdornment>,
            },
            helperText: (
              <>
                Buffer size effects how frequently ffmpeg reconsiders the output
                bitrate.{' '}
                <MuiLink
                  target="_blank"
                  href="https://trac.ffmpeg.org/wiki/Limiting%20the%20output%20bitrate#Whatdoes-bufsizedo"
                >
                  Read more
                </MuiLink>
              </>
            ),
          }}
        />
      </Stack>
      <Stack gap={1}>
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
          <FormHelperText></FormHelperText>
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
      </Stack>
    </Stack>
  );
};
