import { useSettings } from '@/store/settings/selectors.ts';
import {
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Slider,
  Stack,
  Switch,
} from '@mui/material';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid2';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from '@tanstack/react-router';
import type {
  ChannelStreamMode,
  SaveChannelRequest,
  Watermark,
} from '@tunarr/types';
import { find, map, range, round } from 'lodash-es';
import { useMemo, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { typedProperty } from '../../helpers/util.ts';
import { useTranscodeConfigs } from '../../hooks/settingsHooks.ts';
import useStore from '../../store/index.ts';
import { ImageUploadInput } from '../settings/ImageUploadInput.tsx';
import {
  CheckboxFormController,
  NumericFormControllerText,
} from '../util/TypedController.tsx';

const watermarkPositionOptions: {
  value: Watermark['position'];
  label: string;
}[] = [
  { value: 'bottom-right', label: 'Bottom Right' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'top-left', label: 'Top Left' },
];

const ChannelStreamModeOptions: {
  value: ChannelStreamMode;
  label: string;
}[] = [
  {
    value: 'hls',
    label: 'HLS (recommended)',
  },
  {
    value: 'hls_slower',
    label: 'HLS Alt',
  },
  {
    value: 'hls_direct',
    label: 'HLS Direct',
  },
  {
    value: 'mpegts',
    label: 'MPEG-TS (legacy)',
  },
] as const;

export default function ChannelTranscodingConfig() {
  const { backendUri } = useSettings();
  const channel = useStore((s) => s.channelEditor.currentEntity);
  const transcodeConfigs = useTranscodeConfigs();

  const { control, watch, setValue, getValues } =
    useFormContext<SaveChannelRequest>();

  const [watermark, transcodeConfigId] = watch([
    'watermark',
    'transcodeConfigId',
  ]);

  const transcodeConfig = useMemo(
    () => find(transcodeConfigs.data, (conf) => conf.id === transcodeConfigId)!,
    [transcodeConfigId, transcodeConfigs.data],
  );

  const [opacity, setOpacity] = useState(getValues('watermark.opacity'));
  const [safeTitleIndicatorVisible, setSafeTitleIndicatorVisible] =
    useState(false);

  const targetResForPreview = transcodeConfig.resolution;
  const paddingPct = round(
    100 * (targetResForPreview.heightPx / targetResForPreview.widthPx),
    2,
  );
  const aspectRatio = (
    targetResForPreview.widthPx / targetResForPreview.heightPx
  ).toFixed(2);
  const [safeVerticalPct, safeHorizontalPct] =
    aspectRatio === '1.33' ? [80, 80] : [90, 90];
  // Only special case safe title area for 4:3

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
          <Typography variant="h5">Transcoding Settings</Typography>
          <Typography variant="caption">
            Use these settings to override global ffmpeg settings for this
            channel.
          </Typography>
          <Stack direction={{ sm: 'column', md: 'row' }} useFlexGap spacing={2}>
            <FormControl margin="normal">
              <InputLabel>Channel Stream Mode</InputLabel>
              <Controller
                control={control}
                name="streamMode"
                render={({ field }) => (
                  <Select<ChannelStreamMode>
                    label="Channel Resolution"
                    {...field}
                  >
                    {ChannelStreamModeOptions.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </Select>
                )}
              />
              <FormHelperText>
                The streaming mode affects the type of underlying transcoding
                process used to create the channel's video stream.
                <br />
                Learn more about Tunarr's stream modes{' '}
                <Link
                  target="_blank"
                  href="https://tunarr.com/configure/channels/transcoding/#stream-mode"
                >
                  here
                </Link>
                !
              </FormHelperText>
            </FormControl>
            <FormControl margin="normal">
              <InputLabel>Channel Transcode Config</InputLabel>
              <Controller
                control={control}
                name="transcodeConfigId"
                render={({ field }) => (
                  <Select<string> label="Channel Transcode Config" {...field}>
                    {transcodeConfigs.data.map((opt) => (
                      <MenuItem key={opt.id} value={opt.id}>
                        {opt.name}
                      </MenuItem>
                    ))}
                  </Select>
                )}
              />
              <FormHelperText>
                Choose the transcode configuration to use for this channel.
                Configure transcode configurations on the{' '}
                <Link component={RouterLink} to="/settings/ffmpeg">
                  FFmpeg settings page
                </Link>
                .
              </FormHelperText>
            </FormControl>
          </Stack>
        </Box>
        <Divider sx={{ my: 2 }} />
        <Box>
          <Typography variant="h5">Watermark</Typography>
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
              <Stack sx={{ minWidth: '33%' }} spacing={2}>
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
                      opacity: opacity / 100,
                      [isBottom ? 'bottom' : 'top']:
                        `${watermark?.verticalMargin}%`,
                      [isRight ? 'right' : 'left']:
                        `${watermark?.horizontalMargin}%`,
                    }}
                    src={watermarkPath || `${backendUri}/images/tunarr.png`}
                  />
                  {safeTitleIndicatorVisible && (
                    <Box
                      sx={{
                        background: 'transparent',
                        border: '1px red dashed',
                        position: 'absolute',
                        height: `${safeVerticalPct}%`,
                        width: `${safeHorizontalPct}%`,
                        left: `${(100 - safeHorizontalPct) / 2}%`,
                        top: `${(100 - safeVerticalPct) / 2}%`,
                      }}
                    ></Box>
                  )}
                </Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={safeTitleIndicatorVisible}
                      onChange={(_, checked) =>
                        setSafeTitleIndicatorVisible(checked)
                      }
                    />
                  }
                  label={
                    <span>
                      Toggle{' '}
                      <Link
                        href="https://en.wikipedia.org/wiki/Safe_area_(television)#:~:text=The%20title%2Dsafe%20area%20or,screen%20location%20and%20display%20type."
                        target="_blank"
                      >
                        Safe Title Indicator
                      </Link>{' '}
                      lines in preview
                    </span>
                  }
                />
              </Stack>
              <Grid
                container
                spacing={2}
                sx={{ flexGrow: 1, height: 'fit-content' }}
              >
                <Grid size={{ xs: 12 }}>
                  <Controller
                    name="watermark.url"
                    control={control}
                    render={({ field }) => (
                      <ImageUploadInput
                        // TODO: This should be something like {channel.id}_fallback_picture.ext
                        fileRenamer={typedProperty('name')}
                        label="Watermark Image URL"
                        onFormValueChange={(newPath) => field.onChange(newPath)}
                        onUploadError={console.error}
                        FormControlProps={{ fullWidth: true }}
                        value={field.value ?? ''}
                      >
                        <FormHelperText>
                          Leave blank to use the channel's icon.
                        </FormHelperText>
                      </ImageUploadInput>
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <FormControl fullWidth margin="normal">
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
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
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
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
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
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
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
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <FormControl fullWidth>
                    <Typography gutterBottom>Opacity</Typography>
                    <Box sx={{ px: 2 }}>
                      <Slider
                        min={0}
                        max={100}
                        value={opacity}
                        marks={range(0, 100, 10).map((i) => ({ value: i }))}
                        valueLabelDisplay="auto"
                        sx={{ width: '100%' }}
                        onChange={(_, newValue) =>
                          setOpacity(newValue as number)
                        }
                        onChangeCommitted={(_, newValue) =>
                          setValue('watermark.opacity', newValue as number, {
                            shouldDirty: true,
                          })
                        }
                        step={1}
                      />
                    </Box>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Divider />
                </Grid>
                <Grid size={{ xs: 12, lg: 6 }}>
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
                      The image will be rendered at its actual size without any
                      scaling applied.
                    </FormHelperText>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, lg: 6 }}>
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
                      watermark will loop according to the image's
                      configuration. If this option is enabled and the image is
                      not animated, there will be playback errors.
                    </FormHelperText>
                  </FormControl>
                </Grid>

                <Grid size={{ xs: 12, lg: 6 }}>
                  <NumericFormControllerText
                    control={control}
                    name="watermark.fadeConfig.0.periodMins"
                    rules={{ min: 0 }}
                    TextFieldProps={{
                      label: 'Watermark Period (mins)',
                      fullWidth: true,
                      helperText:
                        'Display/hide the watermark via a fade animation every N minutes. Set to 0 to disable.',
                    }}
                  />
                </Grid>
                <Grid size={{ xs: 12, lg: 6 }}>
                  <FormControl fullWidth>
                    <FormControlLabel
                      control={
                        <CheckboxFormController
                          control={control}
                          name="watermark.fadeConfig.0.leadingEdge"
                        />
                      }
                      label="Display Watermark on Leading Edge"
                    />
                    <FormHelperText>
                      When enabled, intermittent watermarks fade in immediately
                      when a stream is initialized. When disabled, the first
                      watermark fade-in occurs after a full period.
                    </FormHelperText>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, lg: 6 }}>
                  <NumericFormControllerText
                    control={control}
                    name="watermark.duration"
                    rules={{ min: 0 }}
                    TextFieldProps={{
                      label: 'Total Watermark Duration (seconds)',
                      fullWidth: true,
                      helperText:
                        "Sets the absolute duration of the watermark on the channel's stream. Set to 0 to make the overlay permantently visible.",
                    }}
                  />
                </Grid>
              </Grid>
            </Stack>
          )}
        </Box>
      </Box>
    )
  );
}
