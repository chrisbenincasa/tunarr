import {
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Input,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Skeleton,
  Stack,
  TextField,
} from '@mui/material';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { SaveChannelRequest } from '@tunarr/types';
import { isEmpty, isNil, isUndefined, map, round } from 'lodash-es';
import { useEffect, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import {
  resolutionFromAnyString,
  resolutionToString,
  typedProperty,
} from '../../helpers/util.ts';
import { useFfmpegSettings } from '../../hooks/settingsHooks.ts';
import { CheckboxFormController } from '../util/TypedController.tsx';
import { ImageUploadInput } from '../settings/ImageUploadInput.tsx';
import Grid2 from '@mui/material/Unstable_Grid2/Grid2';
import useStore from '../../store/index.ts';

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
  const channel = useStore((s) => s.channelEditor.currentEntity);
  const [watermarkPreviewUrl, setWatermarkPreviewUrl] = useState('');

  const { control, watch, setValue } = useFormContext<SaveChannelRequest>();

  const [targetRes, watermark] = watch([
    'transcoding.targetResolution',
    'watermark',
  ]);

  useEffect(() => {
    if (channel && (isNil(watermark?.url) || isEmpty(watermark?.url))) {
      setWatermarkPreviewUrl(
        !isEmpty(channel.icon.path) ? channel.icon.path : '/tunarr.png',
      );
    }
  }, [channel, watermark?.url, setWatermarkPreviewUrl]);

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

  const targetResForPreview = (targetRes === 'global'
    ? ffmpegSettings?.targetResolution
    : targetRes) ?? { widthPx: 1920, heightPx: 1080 };
  const paddingPct = round(
    100 * (targetResForPreview.heightPx / targetResForPreview.widthPx),
    2,
  );

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
    channel && (
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Box>
          <Typography>Watermark</Typography>
          <FormControl fullWidth>
            <FormControlLabel
              control={
                <CheckboxFormController
                  control={control}
                  name="watermark.enabled"
                />
              }
              label="Enable Watermark"
            />
            <FormHelperText>
              Renders a channel icon (also known as bug or Digital On-screen
              Graphic) on top of the channel's stream.
            </FormHelperText>
          </FormControl>
          {watermark?.enabled && (
            <Stack direction="row" mt={2} gap={2} useFlexGap>
              <Box sx={{ minWidth: '33%' }}>
                <Box
                  sx={{
                    width: '100%',
                    padding: `0 0 ${paddingPct}%`,
                    position: 'relative',
                    backgroundColor: (theme) => theme.palette.grey[200],
                    borderColor: (theme) => theme.palette.grey[700],
                    borderStyle: 'solid',
                    borderWidth: 2,
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    component="img"
                    sx={{
                      position: 'absolute',
                      width:
                        watermark?.width && !watermark?.fixedSize
                          ? `${watermark.width}%`
                          : null,
                      bottom: watermark?.verticalMargin,
                      right: watermark?.horizontalMargin,
                    }}
                    src={watermarkPreviewUrl}
                  />
                </Box>
              </Box>
              <Grid2
                container
                spacing={2}
                sx={{ flexGrow: 1, height: 'fit-content' }}
              >
                <Grid2 xs={12}>
                  <Controller
                    name="watermark.url"
                    control={control}
                    render={({ field }) => (
                      <ImageUploadInput
                        // TODO: This should be something like {channel.id}_fallback_picture.ext
                        fileRenamer={typedProperty('name')}
                        label="Watermark Picture URL"
                        onFormValueChange={(value) =>
                          setValue('watermark.url', value)
                        }
                        onUploadError={console.error}
                        onPreviewValueChange={() => {}}
                        FormControlProps={{ fullWidth: true, sx: { mb: 1 } }}
                        value={field.value ?? ''}
                      />
                    )}
                  />
                </Grid2>
                <Grid2 xs={12}>
                  <Controller
                    name="watermark.position"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        sx={{ mb: 1 }}
                        fullWidth
                        label="Position"
                        {...field}
                      />
                    )}
                  />
                </Grid2>
                <Grid2 xs={12} sm={4}>
                  <Controller
                    control={control}
                    name="watermark.width"
                    render={({ field }) => (
                      <TextField fullWidth label="Width %" {...field} />
                    )}
                  />
                </Grid2>
                <Grid2 xs={12} sm={4}>
                  <Controller
                    control={control}
                    name="watermark.horizontalMargin"
                    render={({ field }) => (
                      <TextField
                        fullWidth
                        label="Horizontal Margin %"
                        {...field}
                      />
                    )}
                  />
                </Grid2>
                <Grid2 xs={12} sm={4}>
                  <Controller
                    control={control}
                    name="watermark.verticalMargin"
                    render={({ field }) => (
                      <TextField
                        fullWidth
                        label="Vertical Margin %"
                        {...field}
                      />
                    )}
                  />
                </Grid2>
                <Grid2>
                  <FormControl fullWidth>
                    <FormControlLabel
                      control={
                        <CheckboxFormController
                          control={control}
                          name="watermark.fixedSize"
                        />
                      }
                      label="Disable Image Scaling"
                    />
                    <FormHelperText>
                      The image will be rendered at its actual size without
                      applying any scaling to it.
                    </FormHelperText>
                  </FormControl>
                </Grid2>
                <Grid2>
                  <FormControl fullWidth>
                    <FormControlLabel
                      control={
                        <CheckboxFormController
                          control={control}
                          name="watermark.animated"
                        />
                      }
                      label="Enable Animation"
                    />
                    <FormHelperText>
                      Enable if the watermark is an animated GIF or PNG. The
                      watermark will loop or not loop according to the image's
                      configuration. If this option is enable and the image is
                      not animated, there will be playback errors.
                    </FormHelperText>
                  </FormControl>
                </Grid2>
              </Grid2>
            </Stack>
          )}
        </Box>
        <Divider sx={{ my: 2 }} />
        <Typography>Transcoding Settings</Typography>
        <Typography variant="caption">
          Use these settings to override global ffmpeg settings for this
          channel.
        </Typography>
        <Stack direction="row" gap={2}>
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
        </Stack>
      </Box>
    )
  );
}
