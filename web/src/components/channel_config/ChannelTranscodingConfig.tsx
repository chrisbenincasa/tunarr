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
import Grid2 from '@mui/material/Unstable_Grid2/Grid2';
import { SaveChannelRequest, Watermark } from '@tunarr/types';
import { isNil, isUndefined, map, round, get } from 'lodash-es';
import { useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import {
  resolutionFromAnyString,
  resolutionToString,
  typedProperty,
} from '../../helpers/util.ts';
import { useFfmpegSettings } from '../../hooks/settingsHooks.ts';
import useStore from '../../store/index.ts';
import { ImageUploadInput } from '../settings/ImageUploadInput.tsx';
import {
  CheckboxFormController,
  NumericFormControllerText,
} from '../util/TypedController.tsx';
import ChannelEditActions from './ChannelEditActions.tsx';

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

const watermarkPositionOptions: {
  value: Watermark['position'];
  label: string;
}[] = [
  { value: 'bottom-right', label: 'Bottom Right' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'top-left', label: 'Top Left' },
];

const globalOrNumber = /^(global|\d+|)+$/;

export default function ChannelTranscodingConfig() {
  const { data: ffmpegSettings, isPending: ffmpegSettingsLoading } =
    useFfmpegSettings();
  const channel = useStore((s) => s.channelEditor.currentEntity);

  const { control, watch, setValue, getValues } =
    useFormContext<SaveChannelRequest>();

  const [targetRes, watermark] = watch([
    'transcoding.targetResolution',
    'watermark',
  ]);

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

  const [uiVideoBitrate, setUiVideoBitrate] = useState<string>(() => {
    const value = getValues('transcoding.videoBitrate');
    if (isUndefined(value) || value === 'global') {
      return 'global';
    }
    return value.toString();
  });

  const [uiVideoBufferSize, setUiVideoBufferSize] = useState<string>(() => {
    const value = getValues('transcoding.videoBufferSize');
    if (isUndefined(value) || value === 'global') {
      return 'global';
    }
    return value.toString();
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

  const handleGlobalOrNumber = (
    field: 'transcoding.videoBitrate' | 'transcoding.videoBufferSize',
    value: string,
    originalOnChange: (...event: unknown[]) => void,
  ) => {
    if (field === 'transcoding.videoBitrate') {
      setUiVideoBitrate(value);
    } else {
      setUiVideoBufferSize(value);
    }

    const num = parseInt(value);

    if (!isNaN(num)) {
      originalOnChange(num);
    } else {
      // Explicitly set "wrong" values off so we trigger validation
      // and show the error message. This pattern SUCKS and it's react-hook-form's fault
      // https://github.com/orgs/react-hook-form/discussions/8068
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      originalOnChange(value);
    }
  };

  const isRight =
    watermark?.position === 'bottom-right' ||
    watermark?.position === 'top-right';
  const isBottom =
    watermark?.position === 'bottom-left' ||
    watermark?.position === 'bottom-right';
  const watermarkPath = watch('watermark.url');

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
                      [isBottom ? 'bottom' : 'top']: watermark?.verticalMargin,
                      [isRight ? 'right' : 'left']: watermark?.horizontalMargin,
                    }}
                    src={watermarkPath || '/tunarr.png'}
                  />
                </Box>
              </Box>
              <Grid2
                container
                rowSpacing={1}
                columnSpacing={2}
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
                        onFormValueChange={(newPath) => field.onChange(newPath)}
                        onUploadError={console.error}
                        FormControlProps={{ fullWidth: true, sx: { mb: 1 } }}
                        value={field.value ?? ''}
                      >
                        <FormHelperText>
                          If blank, the channel icon will be used
                        </FormHelperText>
                      </ImageUploadInput>
                    )}
                  />
                </Grid2>
                <Grid2 xs={12}>
                  <FormControl fullWidth sx={{ mb: 1 }}>
                    <InputLabel>Position</InputLabel>
                    <Controller
                      name="watermark.position"
                      control={control}
                      render={({ field }) => (
                        <Select label="Position" {...field}>
                          {map(watermarkPositionOptions, (opt) => (
                            <MenuItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </MenuItem>
                          ))}
                        </Select>
                      )}
                    />
                  </FormControl>
                </Grid2>
                <Grid2 xs={12} sm={4}>
                  <NumericFormControllerText
                    control={control}
                    name="watermark.width"
                    float
                    rules={{
                      min: 0, //{ value: 0, message: 'Width must be >= 0' },
                      max: 100,
                    }}
                    TextFieldProps={{ label: 'Width %', fullWidth: true }}
                  />
                </Grid2>
                <Grid2 xs={12} sm={4}>
                  <NumericFormControllerText
                    control={control}
                    name="watermark.horizontalMargin"
                    float
                    rules={{ min: 0, max: 100 }}
                    TextFieldProps={{
                      label: 'Horizontal Margin %',
                      fullWidth: true,
                    }}
                  />
                </Grid2>
                <Grid2 xs={12} sm={4}>
                  <NumericFormControllerText
                    control={control}
                    name="watermark.verticalMargin"
                    float
                    rules={{ min: 0, max: 100 }}
                    TextFieldProps={{
                      label: 'Vertical Margin %',
                      fullWidth: true,
                    }}
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
                  <FormControl fullWidth sx={{ mb: 1 }}>
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
                <Grid2 xs={12}>
                  <NumericFormControllerText
                    control={control}
                    name="watermark.duration"
                    rules={{ min: 0 }}
                    TextFieldProps={{
                      label: 'Overlay Duration (seconds)',
                      fullWidth: true,
                      helperText: 'Set to 0 to make the overlay permanent',
                    }}
                  />
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
                    disabled={isNil(ffmpegSettings)}
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
                disabled={isNil(ffmpegSettings)}
                rules={{
                  pattern: {
                    value: globalOrNumber,
                    message: "Must be a number or 'global'",
                  },
                  min: 0,
                }}
                render={({ field, formState: { errors } }) => (
                  <TextField
                    label="Video Bitrate (kbps)"
                    error={!isNil(get(errors, 'transcoding.videoBitrate'))}
                    helperText={
                      errors.transcoding && errors.transcoding.videoBitrate
                        ? "Must be a number or 'global'"
                        : null
                    }
                    {...field}
                    value={uiVideoBitrate}
                    onChange={(e) =>
                      handleGlobalOrNumber(
                        'transcoding.videoBitrate',
                        e.target.value,
                        field.onChange,
                      )
                    }
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
                disabled={isNil(ffmpegSettings)}
                rules={{
                  pattern: {
                    value: globalOrNumber,
                    message: "Must be a number or 'global'",
                  },
                  min: 0,
                }}
                render={({ field, formState: { errors } }) => (
                  <TextField
                    label="Video Buffer Size (kbps)"
                    error={!isNil(get(errors, 'transcoding.videoBufferSize'))}
                    helperText={
                      errors.transcoding && errors.transcoding.videoBufferSize
                        ? "Must be a number or 'global'"
                        : null
                    }
                    {...field}
                    value={uiVideoBufferSize}
                    onChange={(e) =>
                      handleGlobalOrNumber(
                        'transcoding.videoBufferSize',
                        e.target.value,
                        field.onChange,
                      )
                    }
                  />
                )}
              />
            )}
          </FormControl>
        </Stack>
        <ChannelEditActions />
      </Box>
    )
  );
}
