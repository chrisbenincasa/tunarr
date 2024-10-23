import { TranscodeResolutionOptions } from '@/helpers/constants.ts';
import { useSystemSettingsSuspense } from '@/hooks/useSystemSettings.ts';
import { HelpOutline } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  Link,
  MenuItem,
  Link as MuiLink,
  Select,
  SelectChangeEvent,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FfmpegSettings,
  TupleToUnion,
  defaultFfmpegSettings,
} from '@tunarr/types';
import { FfmpegLogLevels } from '@tunarr/types/schemas';
import _, { capitalize, chain, isEqual, map, some } from 'lodash-es';
import { useSnackbar } from 'notistack';
import { useEffect, useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import UnsavedNavigationAlert from '../../components/settings/UnsavedNavigationAlert.tsx';
import {
  CheckboxFormController,
  NumericFormControllerText,
  TypedController,
} from '../../components/util/TypedController.tsx';
import {
  handleNumericFormValue,
  resolutionFromAnyString,
  resolutionToString,
} from '../../helpers/util.ts';
import { useFfmpegSettings } from '../../hooks/settingsHooks.ts';
import { useApiQuery } from '../../hooks/useApiQuery.ts';
import { useTunarrApi } from '../../hooks/useTunarrApi.ts';

const supportedVideoBuffer = [
  { value: 0, string: '0 Seconds' },
  { value: 1000, string: '1 Second' },
  { value: 2000, string: '2 Seconds' },
  { value: 3000, string: '3 Seconds' },
  { value: 4000, string: '4 Seconds' },
  { value: 5000, string: '5 Seconds' },
  { value: 10000, string: '10 Seconds' },
];

const supportedMaxFPS = [
  { value: '23.976', string: '23.976 frames per second' },
  { value: '24', string: '24 frames per second' },
  { value: '25', string: '25 frames per second' },
  { value: '29.97', string: '29.97 frames per second' },
  { value: '30', string: '30 frames per second' },
  { value: '50', string: '50 frames per second' },
  { value: '59.94', string: '59.94 frames per second' },
  { value: '60', string: '60 frames per second' },
  { value: '120', string: '120 frames per second' },
];

const FfmpegLogOptions = ['disable', 'console', 'file'] as const;
type FfmpegLogOptions = TupleToUnion<typeof FfmpegLogOptions>;

const supportedErrorScreens = [
  {
    value: 'pic',
    string: 'Default Generic Error Image',
  },
  { value: 'blank', string: 'Blank Screen' },
  { value: 'static', string: 'Static' },
  {
    value: 'testsrc',
    string: 'Test Pattern (color bars + timer)',
  },
  {
    value: 'text',
    string: 'Detailed error (requires ffmpeg with drawtext)',
  },
  {
    value: 'kill',
    string: 'Stop stream, show errors in logs',
  },
];

const supportedErrorAudio = [
  { value: 'whitenoise', string: 'White Noise' },
  { value: 'sine', string: 'Beep' },
  { value: 'silent', string: 'No Audio' },
];

const supportedDeinterlaceFilters: {
  value: DeinterlaceFilterValue;
  string: string;
}[] = [
  { value: 'none', string: 'Disabled' },
  { value: 'bwdif=0', string: 'bwdif send frame' },
  { value: 'bwdif=1', string: 'bwdif send field' },
  { value: 'w3fdif', string: 'w3fdif' },
  { value: 'yadif=0', string: 'yadif send frame' },
  { value: 'yadif=1', string: 'yadif send field' },
];

type ScalingAlgorithmValue = 'bicubic' | 'fast_bilinear' | 'lanczos' | 'spline';

const supportedScalingAlgorithm: ScalingAlgorithmValue[] = [
  'bicubic',
  'fast_bilinear',
  'lanczos',
  'spline',
];

type DeinterlaceFilterValue =
  | 'none'
  | 'bwdif=0'
  | 'bwdif=1'
  | 'w3fdif'
  | 'yadif=0'
  | 'yadif=1';

const VideoFormats = [
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
    value: 'mpeg2',
  },
] as const;

const VideoHardwareAccelerationOptions = [
  {
    description: 'Software (no GPU)',
    value: 'none',
  },
  {
    description: 'Nvidia (CUDA)',
    value: 'cuda',
  },
  {
    description: 'Video Acceleration API (VAAPI) (Best Effort)',
    value: 'vaapi',
  },
  {
    description: 'Intel QuickSync (Best Effort)',
    value: 'qsv',
  },
  {
    description: 'VideoToolbox',
    value: 'videotoolbox',
  },
] as const;

export default function FfmpegSettingsPage() {
  const apiClient = useTunarrApi();
  const { data, isPending, error } = useFfmpegSettings();
  const ffmpegInfo = useApiQuery({
    queryKey: ['ffmpeg-info'],
    queryFn: (apiClient) => apiClient.getFfmpegInfo(),
  });
  const systemSettings = useSystemSettingsSuspense();

  const {
    reset,
    setValue,
    control,
    formState: { isDirty, isValid, isSubmitting, defaultValues },
    handleSubmit,
    watch,
  } = useForm<Omit<FfmpegSettings, 'configVersion'>>({
    defaultValues: defaultFfmpegSettings,
    mode: 'onBlur',
  });

  const [
    ffmpegConsoleLoggingEnabled,
    ffmpegFileLoggingEnabled,
    hardwareAccelerationMode,
  ] = watch(['enableLogging', 'enableFileLogging', 'hardwareAccelerationMode']);
  let logSelectValue: FfmpegLogOptions = 'disable';
  if (ffmpegFileLoggingEnabled) {
    logSelectValue = 'file';
  } else if (ffmpegConsoleLoggingEnabled) {
    logSelectValue = 'console';
  }

  const handleFfmpegLogChange = (value: string) => {
    let logValue: FfmpegLogOptions;
    if (!FfmpegLogOptions.some((v) => v === value)) {
      logValue = 'disable';
    } else {
      logValue = value as FfmpegLogOptions;
    }

    if (logValue === logSelectValue) {
      return;
    }

    switch (logValue) {
      case 'disable':
        setValue('enableLogging', false, { shouldDirty: true });
        setValue('enableFileLogging', false, { shouldDirty: true });
        break;
      case 'console':
        setValue('enableLogging', true, { shouldDirty: true });
        setValue('enableFileLogging', false, { shouldDirty: true });
        break;
      case 'file':
        setValue('enableLogging', false, { shouldDirty: true });
        setValue('enableFileLogging', true, { shouldDirty: true });
        break;
    }
  };

  useEffect(() => {
    if (data) {
      reset(data);
    }
  }, [data, reset]);

  const [restoreTunarrDefaults, setRestoreTunarrDefaults] = useState(false);

  const snackbar = useSnackbar();
  const queryClient = useQueryClient();

  const updateFfmpegSettingsMutation = useMutation({
    mutationFn: apiClient.updateFfmpegSettings,
    onSuccess: (data) => {
      setRestoreTunarrDefaults(false);
      snackbar.enqueueSnackbar('Settings Saved!', {
        variant: 'success',
      });
      reset(data, { keepValues: true });
      return queryClient.invalidateQueries({
        predicate(query) {
          return some(
            [['settings', 'ffmpeg-settings'], ['ffmpeg-info']],
            (key) => isEqual(query.queryKey, key),
          );
        },
      });
    },
  });

  const updateFfmpegSettings: SubmitHandler<
    Omit<FfmpegSettings, 'configVersion'>
  > = (data) => {
    updateFfmpegSettingsMutation.mutate({
      configVersion: defaultFfmpegSettings.configVersion,
      ...data,
    });
  };

  if (isPending || error || ffmpegInfo.isPending || ffmpegInfo.isError) {
    return <div></div>;
  }

  const videoFfmpegSettings = () => {
    return (
      <>
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Video Codec</InputLabel>
          <Controller
            control={control}
            name="videoFormat"
            render={({ field }) => (
              <Select label="Video Codec" {...field}>
                {chain(VideoFormats)
                  .map((opt) => (
                    <MenuItem value={opt.value}>{opt.description}</MenuItem>
                  ))
                  .value()}
              </Select>
            )}
          />
          <FormHelperText></FormHelperText>
        </FormControl>
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Hardware Acceleration</InputLabel>
          <Controller
            control={control}
            name="hardwareAccelerationMode"
            render={({ field }) => (
              <Select label="Hardware Acceleration" {...field}>
                {chain(VideoHardwareAccelerationOptions)
                  .filter(
                    ({ value }) =>
                      value === 'none' ||
                      ffmpegInfo.data.hardwareAccelerationTypes.includes(value),
                  )
                  .map((opt) => (
                    <MenuItem value={opt.value}>{opt.description}</MenuItem>
                  ))
                  .value()}
              </Select>
            )}
          />
          <FormHelperText></FormHelperText>
        </FormControl>

        {hardwareAccelerationMode === 'vaapi' && (
          <Controller
            control={control}
            name="vaapiDevice"
            render={({ field }) => (
              <TextField
                fullWidth
                sx={{ mb: 2 }}
                label="VAAPI Device"
                helperText={
                  <span>
                    Override the default VAAPI device path (defaults to{' '}
                    <code>/dev/dri/renderD128</code> on Linux and blank
                    otherwise)
                  </span>
                }
                {...field}
              />
            )}
          />
        )}

        <Grid container columns={{ sm: 8, md: 16 }} columnSpacing={2}>
          <Grid item sm={16} md={8}>
            <NumericFormControllerText
              control={control}
              name="videoBitrate"
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
          </Grid>
          <Grid item sm={16} md={8}>
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
                  endAdornment: (
                    <InputAdornment position="end">kb</InputAdornment>
                  ),
                },
                helperText: (
                  <>
                    Buffer size effects how frequently ffmpeg reconsiders the
                    output bitrate.{' '}
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
          </Grid>
        </Grid>
        <Stack gap={1}>
          <FormControl sx={{ mt: 2 }} fullWidth>
            <InputLabel id="video-max-frame-rate-label">
              Max Frame Rate
            </InputLabel>
            <TypedController
              control={control}
              name="maxFPS"
              toFormType={(v) => v && handleNumericFormValue(v, true)}
              render={({ field }) => (
                <Select
                  labelId="video-max-frame-rate-label"
                  id="video-max-frame-rate"
                  label="Max Frame Rate"
                  {...field}
                >
                  {supportedMaxFPS.map((fps) => (
                    <MenuItem key={fps.value} value={fps.value}>
                      {fps.string}
                    </MenuItem>
                  ))}
                </Select>
              )}
            />

            <FormHelperText>
              Maximum FPS of a video before the transcoding is enabled
            </FormHelperText>
          </FormControl>
          <FormControl sx={{ mt: 2 }} fullWidth>
            <InputLabel id="video-scaling-algorithm-label">
              Scaling Algorithm
            </InputLabel>
            <Controller
              control={control}
              name="scalingAlgorithm"
              render={({ field }) => (
                <Select
                  labelId="video-scaling-algorithm-label"
                  id="video-scaling-algorithm"
                  label="Scaling Algorithm"
                  {...field}
                >
                  {supportedScalingAlgorithm.map((algorithm) => (
                    <MenuItem key={algorithm} value={algorithm}>
                      {algorithm}
                    </MenuItem>
                  ))}
                </Select>
              )}
            />
            <FormHelperText>
              Scaling algorithm to use when the transcoder needs to change the
              video size.{' '}
              <MuiLink
                target="_blank"
                href="https://ffmpeg.org/ffmpeg-filters.html#Scaling"
              >
                Read more
              </MuiLink>
            </FormHelperText>
          </FormControl>
          <FormControl sx={{ mt: 2 }} fullWidth>
            <InputLabel id="video-deinterlace-filter-label">
              Deinterlace Filter
            </InputLabel>
            <Controller
              control={control}
              name="deinterlaceFilter"
              render={({ field }) => (
                <Select
                  labelId="video-deinterlace-filter-label"
                  id="video-deinterlace-filter"
                  label="Scaling Algorithm"
                  {...field}
                >
                  {supportedDeinterlaceFilters.map((filter) => (
                    <MenuItem key={filter.value} value={filter.value}>
                      {filter.string}
                    </MenuItem>
                  ))}
                </Select>
              )}
            />

            <FormHelperText>
              Deinterlace filter to use when video is interlaced. This is only
              needed when Plex transcoding is not used.{' '}
              <MuiLink
                target="_blank"
                href="https://github.com/kfrn/ffmpeg-things/blob/master/deinterlacing.md"
              >
                Read more
              </MuiLink>
            </FormHelperText>
          </FormControl>
          <FormControl sx={{ mt: 2 }} fullWidth>
            <InputLabel id="target-resolution-label">
              Preferred Resolution
            </InputLabel>
            <TypedController
              control={control}
              name="targetResolution"
              toFormType={resolutionFromAnyString}
              valueExtractor={(e) => (e as SelectChangeEvent).target.value}
              render={({ field }) => (
                <Select
                  labelId="target-resolution-label"
                  id="target-resolution"
                  label="Preferred Resolution"
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
          <FormControl fullWidth>
            <FormControlLabel
              control={
                <CheckboxFormController
                  control={control}
                  name="normalizeResolution"
                />
              }
              label="Normalize Resolution"
            />
            <FormHelperText>
              Some clients experience issues when the video stream changes
              resolution. This option will make Tunarr convert all videos to the
              preferred resolution selected above. Otherwise, the preferred
              resolution will be used as a maximum resolution for transcoding.
            </FormHelperText>
          </FormControl>
          <FormControl>
            <FormControlLabel
              control={
                <CheckboxFormController
                  control={control}
                  name="normalizeVideoCodec"
                />
              }
              label="Normalize Video Codec"
            />
            <FormHelperText>
              Some clients experience issues when the stream's codecs change.
              Enable these so that any videos with different codecs than the
              ones specified above are forcefully transcoded.
            </FormHelperText>
          </FormControl>
        </Stack>
      </>
    );
  };

  const audioFfmpegSettings = () => {
    return (
      <>
        <Controller
          control={control}
          name="audioEncoder"
          render={({ field }) => (
            <TextField
              id="audioEncoder"
              label="Audio Encoder"
              fullWidth
              sx={{ my: 1 }}
              {...field}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip
                      title="Some possible values are:
            aac (default)
            ac3, ac3_fixed
            flac
            libmp3lame"
                    >
                      <IconButton
                        aria-label="Some possible values are:
              aac (default)
              ac3, ac3_fixed
              flac
              libmp3lame"
                        edge="end"
                      >
                        <HelpOutline sx={{ opacity: 0.75 }} />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
            />
          )}
        />

        <Grid container columns={{ sm: 8, md: 16 }} columnSpacing={2}>
          <Grid item sm={16} md={8}>
            <NumericFormControllerText
              control={control}
              name="audioBitrate"
              prettyFieldName="Audio Bitrate"
              TextFieldProps={{
                id: 'audio-bitrate',
                label: 'Audio Bitrate',
                fullWidth: true,
                sx: { my: 1 },
                InputProps: {
                  endAdornment: (
                    <InputAdornment position="end">kbps</InputAdornment>
                  ),
                },
              }}
            />
          </Grid>
          <Grid item sm={16} md={8}>
            <NumericFormControllerText
              control={control}
              name="audioBufferSize"
              prettyFieldName="Audio Buffer Size"
              TextFieldProps={{
                id: 'audio-buffer-size',
                label: 'Audio Buffer Size',
                fullWidth: true,
                sx: { my: 1 },
                InputProps: {
                  endAdornment: (
                    <InputAdornment position="end">kb</InputAdornment>
                  ),
                },
              }}
            />
          </Grid>
        </Grid>
        <Grid container columns={{ sm: 8, md: 16 }} columnSpacing={2}>
          <Grid item sm={16} md={8}>
            <NumericFormControllerText
              control={control}
              name="audioVolumePercent"
              prettyFieldName="Audio Volume Percent"
              TextFieldProps={{
                id: 'audio-volume',
                label: 'Audio Volume',
                fullWidth: true,
                sx: { my: 1 },
                helperText: 'Values higher than 100 will boost the audio.',
                InputProps: {
                  endAdornment: (
                    <InputAdornment position="end">%</InputAdornment>
                  ),
                },
              }}
            />
          </Grid>
          <Grid item sm={16} md={8}>
            <NumericFormControllerText
              control={control}
              name="audioChannels"
              prettyFieldName="Audio Channels"
              TextFieldProps={{
                id: 'audio-bitrate',
                label: 'Audio Channels',
                fullWidth: true,
                sx: { my: 1 },
              }}
            />
          </Grid>
        </Grid>
        <NumericFormControllerText
          control={control}
          name="audioSampleRate"
          prettyFieldName="Audio Sample Rate"
          TextFieldProps={{
            id: 'audio-sample-rate',
            label: 'Audio Sample Rate',
            fullWidth: true,
            sx: { my: 1 },
            InputProps: {
              endAdornment: <InputAdornment position="end">kHz</InputAdornment>,
            },
          }}
        />
      </>
    );
  };

  return (
    <Box component="form" onSubmit={handleSubmit(updateFfmpegSettings)}>
      <Stack spacing={2} useFlexGap>
        {!systemSettings.data.adminMode && (
          <Alert severity="info">
            Tunarr must be run in admin mode in order to update the FFmpeg and
            FFprobe executable paths. The paths can also be updated from the
            command line.
          </Alert>
        )}
        <FormControl fullWidth>
          <Controller
            control={control}
            name="ffmpegExecutablePath"
            disabled={!systemSettings.data.adminMode}
            render={({ field }) => (
              <TextField
                id="ffmpeg-executable-path"
                label="FFmpeg Executable Path"
                helperText={
                  'FFmpeg version 6.0+ recommended. Check your current version in the sidebar'
                }
                {...field}
              />
            )}
          />
        </FormControl>
        <FormControl fullWidth>
          <Controller
            control={control}
            name="ffprobeExecutablePath"
            disabled={!systemSettings.data.adminMode}
            render={({ field }) => (
              <TextField
                id="ffprobe-executable-path"
                label="FFprobe Executable Path"
                helperText={
                  'FFprobe version 6.0+ recommended. Check your current version in the sidebar'
                }
                {...field}
              />
            )}
          />
        </FormControl>
      </Stack>
      <Typography variant="h6" sx={{ my: 2 }}>
        Miscellaneous Options
      </Typography>
      <Stack spacing={2} useFlexGap>
        <Stack spacing={2} useFlexGap direction={{ sm: 'column', md: 'row' }}>
          <NumericFormControllerText
            control={control}
            name="numThreads"
            prettyFieldName="Threads"
            TextFieldProps={{
              label: 'Threads',
              sx: {
                maxWidth: {
                  md: '50%',
                },
              },
              helperText: (
                <>
                  Sets the number of threads used to decode the input stream.
                  Set to 0 to let ffmpeg automatically decide how many threads
                  to use. Read more about this option{' '}
                  <Link
                    target="_blank"
                    href="https://ffmpeg.org/ffmpeg-codecs.html#:~:text=threads%20integer%20(decoding/encoding%2Cvideo)"
                  >
                    here
                  </Link>
                </>
              ),
            }}
          />
          <FormControl sx={{ flex: 1 }}>
            <InputLabel id="video-concat-mux-delay-label">
              Video Buffer
            </InputLabel>
            <TypedController
              control={control}
              name="concatMuxDelay"
              prettyFieldName="Video Buffer"
              toFormType={handleNumericFormValue}
              valueExtractor={(e) =>
                (e as SelectChangeEvent<number>).target.value
              }
              render={({ field }) => (
                <Select
                  labelId="video-concat-mux-delay-label"
                  id="video-concat-mux-delay"
                  label="Video Buffer"
                  {...field}
                >
                  {supportedVideoBuffer.map((buffer) => (
                    <MenuItem key={buffer.value} value={buffer.value}>
                      {buffer.string}
                    </MenuItem>
                  ))}
                </Select>
              )}
            />

            <FormHelperText>
              Note: If you experience playback issues upon stream start, try
              increasing this.
            </FormHelperText>
          </FormControl>
        </Stack>
        <Stack spacing={2} direction={{ sm: 'column', md: 'row' }}>
          <FormControl sx={{ flexBasis: '50%' }}>
            <InputLabel id="ffmpeg-logging-label">FFMPEG Log Method</InputLabel>
            <Select<(typeof FfmpegLogOptions)[number]>
              labelId="ffmpeg-logging-label"
              id="ffmpeg-logging"
              label="FFMPEG Log Method"
              value={logSelectValue}
              onChange={(e: SelectChangeEvent<FfmpegLogOptions>) =>
                handleFfmpegLogChange(e.target.value)
              }
            >
              <MenuItem value="disable">Disabled</MenuItem>
              <MenuItem value="console">Console</MenuItem>
              <MenuItem value="file">File</MenuItem>
            </Select>

            <FormHelperText>
              Enable ffmpeg logging to different sinks. Outputting to a file
              will create a new log file for every spawned ffmpeg process in the
              Tunarr log directory. These files are automatically cleaned up by
              a background process.
            </FormHelperText>
          </FormControl>
          {logSelectValue !== 'disable' && (
            <FormControl sx={{ flex: 1 }}>
              <InputLabel id="ffmpeg-logging-level">
                FFMPEG Log Level
              </InputLabel>
              <Controller
                control={control}
                name="logLevel"
                render={({ field }) => (
                  <Select
                    labelId="ffmpeg-logging-level"
                    id="ffmpeg-logging-level"
                    label="FFMPEG Log Level"
                    {...field}
                  >
                    {map(FfmpegLogLevels, (level) => (
                      <MenuItem key={level} value={level}>
                        {capitalize(level)}
                      </MenuItem>
                    ))}
                  </Select>
                )}
              />

              <FormHelperText>
                Log level to pass to ffmpeg. Read more about ffmpeg's log levels{' '}
                <Link
                  target="_blank"
                  href="https://ffmpeg.org/ffmpeg.html#:~:text=%2Dloglevel%20%5Bflags%2B%5Dloglevel%20%7C%20%2Dv%20%5Bflags%2B%5Dloglevel"
                >
                  here
                </Link>
              </FormHelperText>
            </FormControl>
          )}
        </Stack>
      </Stack>
      <Divider sx={{ mt: 2 }} />
      <Typography variant="h5" sx={{ mt: 2, mb: 1 }}>
        Transcoding Options
      </Typography>
      <Grid container spacing={2} columns={16}>
        <Grid item sm={16} md={8}>
          <Typography component="h6" variant="h6" sx={{ mb: 2 }}>
            Video Options
          </Typography>
          {videoFfmpegSettings()}
        </Grid>
        <Grid item sm={16} md={8}>
          <Typography component="h6" variant="h6" sx={{ pb: 1 }}>
            Audio Options
          </Typography>
          {audioFfmpegSettings()}
        </Grid>
      </Grid>
      <Divider sx={{ mt: 2 }} />
      <Typography component="h6" variant="h6" sx={{ pt: 2, pb: 1 }}>
        Error Options
      </Typography>
      <Grid container spacing={2} columns={16}>
        <Grid item sm={16} md={8}>
          <FormControl sx={{ mt: 2 }}>
            <InputLabel id="error-screen-label">Error Screen</InputLabel>
            <Controller
              control={control}
              name="errorScreen"
              render={({ field }) => (
                <Select
                  labelId="error-screen-label"
                  id="error-screen"
                  label="Error Screen"
                  {...field}
                >
                  {supportedErrorScreens.map((error) => (
                    <MenuItem key={error.value} value={error.value}>
                      {error.string}
                    </MenuItem>
                  ))}
                </Select>
              )}
            />

            <FormHelperText>
              If there are issues playing a video, Tunarr will try to use an
              error screen as a placeholder while retrying loading the video
              every 60 seconds.
            </FormHelperText>
          </FormControl>
        </Grid>
        <Grid item sm={16} md={8}>
          <FormControl sx={{ mt: 2 }} fullWidth>
            <InputLabel id="error-audio-label">Error Audio</InputLabel>
            <Controller
              control={control}
              name="errorAudio"
              render={({ field }) => (
                <Select
                  labelId="error-audio-label"
                  id="error-screen"
                  label="Error Audio"
                  fullWidth
                  {...field}
                >
                  {supportedErrorAudio.map((error) => (
                    <MenuItem key={error.value} value={error.value}>
                      {error.string}
                    </MenuItem>
                  ))}
                </Select>
              )}
            />
          </FormControl>
        </Grid>
      </Grid>
      <Typography component="h6" variant="h6" sx={{ pt: 2, pb: 1 }}>
        Misc Options
      </Typography>

      <FormControl fullWidth>
        <FormControlLabel
          control={
            <Controller
              control={control}
              name="disableChannelOverlay"
              render={({ field }) => (
                <Checkbox {...field} checked={field.value} />
              )}
            />
          }
          label="Disable Channel Watermark Globally"
        />
        <FormHelperText>
          Toggling this option will disable channel watermarks regardless of
          channel settings.
        </FormHelperText>
      </FormControl>

      <FormControl fullWidth>
        <FormControlLabel
          control={
            <Controller
              control={control}
              name="disableChannelPrelude"
              render={({ field }) => (
                <Checkbox {...field} checked={field.value} />
              )}
            />
          }
          label="Disable Channel Prelude"
        />
        <FormHelperText>
          In an attempt to improve playback, Tunarr insets really short clips of
          black screen between videos. The idea is that if the stream pauses
          because Plex is taking too long to reply, it will pause during one of
          those black screens instead of interrupting the last second of a
          video. If you suspect these black screens are causing trouble instead
          of helping, you can disable them with this option.
        </FormHelperText>
      </FormControl>

      <UnsavedNavigationAlert isDirty={isDirty} />
      <Stack spacing={2} direction="row" sx={{ mt: 2 }}>
        <Stack
          spacing={2}
          direction="row"
          justifyContent="left"
          sx={{ mt: 2, flexGrow: 1 }}
        >
          {!_.isEqual(defaultValues, defaultFfmpegSettings) && (
            <Button
              variant="outlined"
              onClick={() => {
                reset(defaultFfmpegSettings);
                setRestoreTunarrDefaults(true);
              }}
            >
              Restore Default Settings
            </Button>
          )}
        </Stack>
        <Stack spacing={2} direction="row" justifyContent="right">
          {(isDirty || (isDirty && !isSubmitting) || restoreTunarrDefaults) && (
            <Button
              variant="outlined"
              onClick={() => {
                reset(data);
                setRestoreTunarrDefaults(false);
              }}
            >
              Reset Changes
            </Button>
          )}
          <Button
            variant="contained"
            disabled={
              !isValid || isSubmitting || (!isDirty && !restoreTunarrDefaults)
            }
            type="submit"
          >
            Save
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
