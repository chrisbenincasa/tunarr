import {
  CircularProgress,
  Divider,
  FormControl,
  Input,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Skeleton,
  TextField,
} from '@mui/material';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { SaveChannelRequest } from '@tunarr/types';
import { isNil, isUndefined, map } from 'lodash-es';
import { useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import {
  resolutionFromAnyString,
  resolutionToString,
} from '../../helpers/util.ts';
import { useFfmpegSettings } from '../../hooks/settingsHooks.ts';

const resolutionOptions = [
  { value: '420x420', label: '420x420 (1:1)' },
  { value: '480x270', label: '480x270 (HD1080/16 16:9)' },
  { value: '576x320', label: '576x320 (18:10)' },
  { value: '640x360', label: '640x360 (nHD 16:9)' },
  { value: '720x480', label: '720x480 (WVGA 3:2)' },
  { value: '800x600', label: '800x600 (SVGA 4:3)' },
  { value: '1024x768', label: '1024x768 (WXGA 4:3)' },
  { value: '1280x720', label: '1280x720 (HD 16:9)' },
  { value: '1920x1080', label: '1920x1080 (FHD 16:9)' },
  { value: '3840x2160', label: '3840x2160 (4K 16:9)' },
] as const;

type ResolutionOptionValues =
  | (typeof resolutionOptions)[number]['value']
  | 'global';

const resolutionValues = new Set<string>([
  'global',
  ...map(resolutionOptions, 'value'),
]);

const globalOrNumber = /^(global|\d+|)+$/;

export default function ChannelTranscodingConfig() {
  const { data: ffmpegSettings, isPending: ffmpegSettingsLoading } =
    useFfmpegSettings();

  const { control, watch, setValue } = useFormContext<SaveChannelRequest>();
  const targetRes = watch('transcoding.targetResolution');
  const [targetResString, setTargetResString] =
    useState<ResolutionOptionValues>(() => {
      if (isUndefined(targetRes) || targetRes === 'global') {
        return 'global';
      }
      const asStr = resolutionToString(targetRes);
      if (resolutionValues.has(asStr)) {
        return asStr as ResolutionOptionValues;
      }

      return 'global';
    });

  if (ffmpegSettingsLoading) {
    return <CircularProgress />;
  }

  const allResolutionOptions = [
    {
      value: 'global',
      label: `Use global setting: ${
        ffmpegSettings?.targetResolution
          ? resolutionToString(ffmpegSettings.targetResolution)
          : 'Unset'
      }`,
    },
    ...resolutionOptions,
  ];

  const handleResolutionChange = (
    e: SelectChangeEvent<ResolutionOptionValues>,
  ) => {
    if (e.target.value === 'global') {
      setTargetResString('global');
      setValue('transcoding.targetResolution', 'global');
    } else if (resolutionValues.has(e.target.value)) {
      setTargetResString(e.target.value as ResolutionOptionValues);
      setValue(
        'transcoding.targetResolution',
        resolutionFromAnyString(e.target.value),
      );
    }
  };

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Box>
        <Typography>Watermark</Typography>
      </Box>
      <Divider sx={{ my: 2 }} />
      <Typography>Transcoding Settings</Typography>
      <Typography variant="caption">
        Use these settings to override global ffmpeg settings for this channel.
      </Typography>
      <Box sx={{ flex: 1 }}>
        <FormControl margin="normal">
          <InputLabel>Channel Resolution</InputLabel>
          {ffmpegSettingsLoading ? (
            <Skeleton>
              <Input />
            </Skeleton>
          ) : (
            <Controller
              control={control}
              name="transcoding.targetResolution"
              render={() => (
                <Select<ResolutionOptionValues>
                  disabled={
                    isNil(ffmpegSettings) || !ffmpegSettings.enableTranscoding
                  }
                  label="Channel Resolution"
                  value={targetResString}
                  onChange={(e) => handleResolutionChange(e)}
                >
                  {allResolutionOptions.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              )}
            />
          )}
        </FormControl>
        <FormControl margin="normal">
          {ffmpegSettingsLoading ? (
            <Skeleton>
              <Input />
            </Skeleton>
          ) : (
            <Controller
              control={control}
              name="transcoding.videoBitrate"
              disabled={
                isNil(ffmpegSettings) || !ffmpegSettings.enableTranscoding
              }
              rules={{ pattern: globalOrNumber }}
              render={({ field, formState: { errors } }) => (
                <TextField
                  label="Video Bitrate (kbps)"
                  helperText={
                    errors.transcoding && errors.transcoding.videoBitrate
                      ? "Must be a number or 'global'"
                      : null
                  }
                  {...field}
                />
              )}
            />
          )}
        </FormControl>
        <FormControl margin="normal">
          {ffmpegSettingsLoading ? (
            <Skeleton>
              <Input />
            </Skeleton>
          ) : (
            <Controller
              control={control}
              name="transcoding.videoBufferSize"
              disabled={
                isNil(ffmpegSettings) || !ffmpegSettings.enableTranscoding
              }
              rules={{ pattern: globalOrNumber }}
              render={({ field, formState: { errors } }) => (
                <TextField
                  label="Video Buffer Size (kbps)"
                  helperText={
                    errors.transcoding && errors.transcoding.videoBufferSize
                      ? "Must be a number or 'global'"
                      : null
                  }
                  {...field}
                />
              )}
            />
          )}
        </FormControl>
      </Box>
    </Box>
  );
}
