import {
  CheckboxFormController,
  NumericFormControllerText,
  TypedController,
} from '@/components/util/TypedController';
import { TranscodeResolutionOptions } from '@/helpers/constants';
import type { DropdownOption } from '@/helpers/DropdownOption';
import {
  isNonEmptyString,
  resolutionFromAnyString,
  resolutionToString,
} from '@/helpers/util';
import { useFfmpegSettings } from '@/hooks/settingsHooks';
import { useApiSuspenseQuery } from '@/hooks/useApiQuery';
import type { SelectChangeEvent } from '@mui/material';
import {
  Box,
  Button,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid2 as Grid,
  InputAdornment,
  InputLabel,
  MenuItem,
  Link as MuiLink,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type {
  SupportedTranscodeVideoOutputFormat,
  TranscodeConfig,
} from '@tunarr/types';
import type {
  SupportedHardwareAccels,
  SupportedTranscodeAudioOutputFormats,
} from '@tunarr/types/schemas';
import { chain } from 'lodash-es';
import { useSnackbar } from 'notistack';
import type { FieldErrors } from 'react-hook-form';
import { Controller, useForm } from 'react-hook-form';
import Breadcrumbs from '../../Breadcrumbs.tsx';

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
    description: 'Copy',
    value: 'copy',
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
      description: 'Video Acceleration API (VA-API) (Best Effort)',
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

type Props = {
  onSave: (config: TranscodeConfig) => Promise<TranscodeConfig>;
  initialConfig: TranscodeConfig;
  isNew?: boolean;
};

export const TranscodeConfigSettingsForm = ({
  onSave,
  initialConfig,
  isNew,
}: Props) => {
  const { data: ffmpegSettings } = useFfmpegSettings();

  const ffmpegInfo = useApiSuspenseQuery({
    queryKey: ['ffmpeg-info'],
    queryFn: (apiClient) => apiClient.getFfmpegInfo(),
  });

  const snackbar = useSnackbar();

  const {
    control,
    watch,
    reset,
    formState: { isSubmitting, isValid, isDirty },
    handleSubmit,
  } = useForm<TranscodeConfig>({
    defaultValues: initialConfig,
    mode: 'onChange',
  });

  const hardwareAccelerationMode = watch('hardwareAccelerationMode');

  const saveForm = async (data: TranscodeConfig) => {
    try {
      const newConfig = await onSave(data);
      reset(newConfig);
      snackbar.enqueueSnackbar('Successfully saved config!', {
        variant: 'success',
      });
    } catch (e) {
      console.error(e);
      snackbar.enqueueSnackbar(
        'Error while saving transcode config. See console log for details.',
        {
          variant: 'error',
        },
      );
    }
  };

  const handleSubmitError = (errors: FieldErrors<TranscodeConfig>) => {
    console.error(errors);
  };

  const videoFfmpegSettings = () => {
    return (
      <Stack gap={2}>
        <FormControl fullWidth>
          <InputLabel>Video Format</InputLabel>
          <Controller
            control={control}
            name="videoFormat"
            render={({ field }) => (
              <Select label="Video Format" {...field}>
                {chain(VideoFormats)
                  .map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.description}
                    </MenuItem>
                  ))
                  .value()}
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
                {chain(VideoHardwareAccelerationOptions)
                  .filter(
                    ({ value }) =>
                      value === 'none' ||
                      ffmpegInfo.data.hardwareAccelerationTypes.includes(value),
                  )
                  .map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.description}
                    </MenuItem>
                  ))
                  .value()}
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
                    {hardwareAccelerationMode === 'qsv' ? 'QSV' : 'VA-API'}{' '}
                    device path (defaults to <code>/dev/dri/renderD128</code> on
                    Linux and blank otherwise)
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
        </Stack>
        <Stack gap={1}>
          {ffmpegSettings.useNewFfmpegPipeline && (
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
          )}
          {ffmpegSettings.useNewFfmpegPipeline && (
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
          )}
        </Stack>
      </Stack>
    );
  };

  const audioFfmpegSettings = () => {
    return (
      <Stack gap={2}>
        <FormControl fullWidth>
          <InputLabel>Audio Format</InputLabel>
          <Controller
            control={control}
            name="audioFormat"
            render={({ field }) => (
              <Select<SupportedTranscodeAudioOutputFormats>
                label="Audio Format"
                {...field}
              >
                {chain(AudioFormats)
                  .map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.description}
                    </MenuItem>
                  ))
                  .value()}
              </Select>
            )}
          />
        </FormControl>

        <Stack direction={{ sm: 'column', md: 'row' }} gap={2} useFlexGap>
          <NumericFormControllerText
            control={control}
            name="audioBitRate"
            prettyFieldName="Audio Bitrate"
            TextFieldProps={{
              id: 'audio-bitrate',
              label: 'Audio Bitrate',
              fullWidth: true,
              InputProps: {
                endAdornment: (
                  <InputAdornment position="end">kbps</InputAdornment>
                ),
              },
            }}
          />
          <NumericFormControllerText
            control={control}
            name="audioBufferSize"
            prettyFieldName="Audio Buffer Size"
            TextFieldProps={{
              id: 'audio-buffer-size',
              label: 'Audio Buffer Size',
              fullWidth: true,
              InputProps: {
                endAdornment: (
                  <InputAdornment position="end">kb</InputAdornment>
                ),
              },
            }}
          />
        </Stack>
        <Stack direction={{ sm: 'column', md: 'row' }} gap={2} useFlexGap>
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
                endAdornment: <InputAdornment position="end">%</InputAdornment>,
              },
            }}
          />
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
        </Stack>

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
      </Stack>
    );
  };

  return (
    <Box component="form" onSubmit={handleSubmit(saveForm, handleSubmitError)}>
      <Breadcrumbs />
      <Stack spacing={2}>
        <Typography variant="h5">
          Edit Config: "{initialConfig.name}"
        </Typography>
        <Divider />
        <Box>
          <Typography variant="h6" sx={{ mb: 2 }}>
            General
          </Typography>
          <Grid container columnSpacing={2}>
            <Grid size={{ sm: 12, md: 6 }}>
              <Controller
                control={control}
                name="name"
                rules={{
                  required: true,
                  minLength: 1,
                }}
                render={({ field, fieldState: { error } }) => (
                  <TextField
                    fullWidth
                    label="Name"
                    error={!!error}
                    helperText={
                      isNonEmptyString(error?.message)
                        ? error.message
                        : error?.type === 'required'
                          ? 'Name is required'
                          : error?.type === 'minLength'
                            ? 'Name is required'
                            : null
                    }
                    {...field}
                  />
                )}
              />
            </Grid>
            <Grid size={{ sm: 12, md: 6 }}>
              <NumericFormControllerText
                control={control}
                name="threadCount"
                prettyFieldName="Threads"
                TextFieldProps={{
                  label: 'Threads',
                  fullWidth: true,
                  helperText: (
                    <>
                      Sets the number of threads used to decode the input
                      stream. Set to 0 to let ffmpeg automatically decide how
                      many threads to use. Read more about this option{' '}
                      <MuiLink
                        target="_blank"
                        href="https://ffmpeg.org/ffmpeg-codecs.html#:~:text=threads%20integer%20(decoding/encoding%2Cvideo)"
                      >
                        here
                      </MuiLink>
                    </>
                  ),
                }}
              />
            </Grid>
            <Grid size={12}>
              <FormControl fullWidth>
                <FormControlLabel
                  control={
                    <CheckboxFormController
                      control={control}
                      name="disableChannelOverlay"
                    />
                  }
                  label={'Disable Watermarks'}
                />
                <FormHelperText>
                  If set, all watermark overlays will be disabled for channels
                  assigned this transcode config.
                </FormHelperText>
              </FormControl>
            </Grid>
          </Grid>
        </Box>
        <Divider />

        <Grid container columnSpacing={2}>
          <Grid size={{ sm: 12, md: 6 }}>
            <Typography component="h6" variant="h6" sx={{ mb: 2 }}>
              Video Options
            </Typography>
            {videoFfmpegSettings()}
          </Grid>
          <Grid size={{ sm: 12, md: 6 }}>
            <Typography component="h6" variant="h6" sx={{ mb: 2 }}>
              Audio Options
            </Typography>
            {audioFfmpegSettings()}
          </Grid>
          <Grid size={12} sx={{ mt: 2 }}>
            <Divider />
          </Grid>
          <Grid size={12}>
            <Typography component="h6" variant="h6" sx={{ pt: 2, pb: 1 }}>
              Error Options
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ sm: 12, md: 6 }}>
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
                    If there are issues playing a video, Tunarr will try to use
                    an error screen as a placeholder while retrying loading the
                    video every 60 seconds.
                  </FormHelperText>
                </FormControl>
              </Grid>
              <Grid size={{ sm: 12, md: 6 }}>
                <FormControl sx={{ mt: 2 }} fullWidth>
                  <InputLabel id="error-audio-label">Error Audio</InputLabel>
                  <Controller
                    control={control}
                    name="errorScreenAudio"
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
          </Grid>
        </Grid>
        <Stack spacing={2} direction="row" justifyContent="right">
          {(isDirty || (isDirty && !isSubmitting)) && (
            <Button
              variant="outlined"
              onClick={() => {
                reset();
              }}
            >
              Reset Changes
            </Button>
          )}
          <Button
            variant="contained"
            disabled={!isValid || isSubmitting || (!isDirty && !isNew)}
            type="submit"
          >
            Save
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};
