import React, { useEffect } from 'react';
import {
  Button,
  Checkbox,
  FormControl,
  FormHelperText,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Stack,
  Select,
  TextField,
  Typography,
  SelectChangeEvent,
  Alert,
  Snackbar,
  Grid,
} from '@mui/material';
import { useFfmpegSettings } from '../../hooks/settingsHooks.ts';
import { hasOnlyDigits } from '../../helpers/util.ts';
import { FfmpegSettings, defaultFfmpegSettings } from 'dizquetv-types';
import { useMutation, useQueryClient } from '@tanstack/react-query';

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
  { value: '60', string: '60 frames per secondsecond' },
  { value: '120', string: '120 frames per second' },
];

const supportedScalingAlgorithm = [
  'bicubic',
  'fast_bilinear',
  'lanczos',
  'spline',
];

const supportedDeinterlaceFilters = [
  { value: 'none', string: 'do not deinterlace' },
  { value: 'bwdif=0', string: 'bwdif send frame' },
  { value: 'bwdif=1', string: 'bwdif send field' },
  { value: 'w3fdif', string: 'w3fdif' },
  { value: 'yadif=0', string: 'yadif send frame' },
  { value: 'yadif=1', string: 'yadif send field' },
];

type ScalingAlgorithmValue = 'bicubic' | 'fast_bilinear' | 'lanczos' | 'spline';

type DeinterlaceFilterValue =
  | 'none'
  | 'bwdif=0'
  | 'bwdif=1'
  | 'w3fdif'
  | 'yadif=0'
  | 'yadif=1';

export default function FfmpegSettingsPage() {
  const { data, isPending, error } = useFfmpegSettings();
  const [snackStatus, setSnackStatus] = React.useState<boolean>(false);
  const [ffmpegExecutablePath, setFfmpegExecutablePath] =
    React.useState<string>(defaultFfmpegSettings.ffmpegExecutablePath);

  const [numThreads, setNumThreads] = React.useState<string>(
    defaultFfmpegSettings.numThreads.toString(),
  );

  const [enableLogging, setEnableLogging] = React.useState<boolean>(
    defaultFfmpegSettings.enableLogging,
  );

  const [concatMuxDelay, setConcatMuxDelay] = React.useState<string>(
    defaultFfmpegSettings.concatMuxDelay.toString(),
  );

  const [enableTranscoding, setEnableTranscoding] = React.useState<boolean>(
    defaultFfmpegSettings.enableTranscoding,
  );

  const [videoEncoder, setVideoEncoder] = React.useState<string>(
    defaultFfmpegSettings.videoEncoder,
  );

  const [videoBitrate, setVideoBitrate] = React.useState<string>(
    defaultFfmpegSettings.videoBitrate.toString(),
  );

  const [videoBufferSize, setVideoBufferSize] = React.useState<string>(
    defaultFfmpegSettings.videoBufferSize.toString(),
  );

  const [maxFPS, setMaxFPS] = React.useState<string>(
    defaultFfmpegSettings.maxFPS.toString(),
  );

  const [scalingAlgorithm, setScalingAlgorithm] =
    React.useState<ScalingAlgorithmValue>(
      defaultFfmpegSettings.scalingAlgorithm,
    );

  const [deinterlaceFilter, setDeinterlaceFilter] =
    React.useState<DeinterlaceFilterValue>(
      defaultFfmpegSettings.deinterlaceFilter,
    );

  const [audioEncoder, setAudioEncoder] = React.useState<string>(
    defaultFfmpegSettings.audioEncoder,
  );

  const [audioBitrate, setAudioBitrate] = React.useState<string>(
    defaultFfmpegSettings.audioBitrate.toString(),
  );

  const [audioBufferSize, setAudioBufferSize] = React.useState<string>(
    defaultFfmpegSettings.audioBufferSize.toString(),
  );

  const [audioVolumePercent, setAudioVolumePercent] = React.useState<string>(
    defaultFfmpegSettings.audioVolumePercent.toString(),
  );

  const [audioChannels, setAudioChannels] = React.useState<string>(
    defaultFfmpegSettings.audioChannels.toString(),
  );

  const [audioSampleRate, setAudioSampleRate] = React.useState<string>(
    defaultFfmpegSettings.audioSampleRate.toString(),
  );

  const [showFormError, setShowFormError] = React.useState<boolean>(false);
  const queryClient = useQueryClient();

  const updateFfmpegSettingsMutation = useMutation({
    mutationFn: (updateSettings: FfmpegSettings) => {
      return fetch('http://localhost:8000/api/ffmpeg-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateSettings),
      });
    },
    onSuccess: () => {
      setSnackStatus(true);
      return queryClient.invalidateQueries({
        queryKey: ['settings', 'ffmpeg-settings'],
      });
    },
  });

  console.log(defaultFfmpegSettings.deinterlaceFilter);

  console.log(data);

  // TO DO: Add All Fields and remove defaults
  // refactor
  const updateFfmpegSettings = () => {
    updateFfmpegSettingsMutation.mutate({
      configVersion: defaultFfmpegSettings.configVersion,
      ffmpegExecutablePath,
      numThreads: Number(numThreads),
      concatMuxDelay: Number(concatMuxDelay),
      enableLogging,
      enableTranscoding,
      audioVolumePercent: Number(audioVolumePercent),
      videoEncoder,
      audioEncoder,
      targetResolution: defaultFfmpegSettings.targetResolution,
      videoBitrate: Number(videoBitrate),
      videoBufferSize: Number(videoBufferSize),
      audioBitrate: Number(audioBitrate),
      audioBufferSize: Number(audioBufferSize),
      audioSampleRate: Number(audioSampleRate),
      audioChannels: Number(audioChannels),
      errorScreen: defaultFfmpegSettings.errorScreen,
      errorAudio: defaultFfmpegSettings.errorAudio,
      normalizeVideoCodec: defaultFfmpegSettings.normalizeVideoCodec,
      normalizeAudioCodec: defaultFfmpegSettings.normalizeAudioCodec,
      normalizeResolution: defaultFfmpegSettings.normalizeResolution,
      normalizeAudio: defaultFfmpegSettings.normalizeAudio,
      maxFPS: Number(maxFPS),
      scalingAlgorithm,
      deinterlaceFilter,
      disableChannelOverlay: defaultFfmpegSettings.disableChannelOverlay,
    });
  };

  const handleResetOptions = () => {
    updateFfmpegSettingsMutation.mutate({
      ...defaultFfmpegSettings,
    });
    setFfmpegExecutablePath(defaultFfmpegSettings.ffmpegExecutablePath);
    setNumThreads(defaultFfmpegSettings.numThreads.toString());
    setEnableLogging(defaultFfmpegSettings.enableLogging);
    setVideoBufferSize(defaultFfmpegSettings.videoBufferSize.toString());
    setEnableTranscoding(defaultFfmpegSettings.enableLogging);
  };

  useEffect(() => {
    setFfmpegExecutablePath(
      data?.ffmpegExecutablePath || defaultFfmpegSettings.ffmpegExecutablePath,
    );

    setNumThreads(
      data?.numThreads?.toString() ||
        defaultFfmpegSettings.numThreads.toString(),
    );

    setEnableLogging(
      data?.enableLogging || defaultFfmpegSettings.enableLogging,
    );

    setVideoBufferSize(
      data?.videoBufferSize?.toString() ||
        defaultFfmpegSettings.videoBufferSize.toString(),
    );

    setEnableTranscoding(
      data?.enableTranscoding || defaultFfmpegSettings.enableTranscoding,
    );
  }, [data]);

  const handleFfmpegExecutablePath = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setFfmpegExecutablePath(event.target.value);
  };

  const handleNumThreads = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNumThreads(event.target.value);
  };

  const handleEnableLogging = () => {
    setEnableLogging(!enableLogging);
  };

  const handleConcatMuxDelay = (event: SelectChangeEvent<string>) => {
    setConcatMuxDelay(event.target.value);
  };

  const handleEnableTranscoding = () => {
    setEnableTranscoding(!enableTranscoding);
  };

  const handleVideoEncoder = (event: React.FocusEvent<HTMLInputElement>) => {
    setVideoEncoder(event.target.value);
  };

  const handleVideoBitrate = (event: React.FocusEvent<HTMLInputElement>) => {
    setVideoBitrate(event.target.value);
  };

  const handleVideoBufferSize = (event: React.FocusEvent<HTMLInputElement>) => {
    setVideoBufferSize(event.target.value);
  };

  const handleScalingAlgorithm = (algorithm: ScalingAlgorithmValue) => {
    setScalingAlgorithm(algorithm);
  };

  const handleDeinterlaceFilter = (filter: DeinterlaceFilterValue) => {
    setDeinterlaceFilter(filter);
  };

  const handleMaxFPS = (event: SelectChangeEvent<string>) => {
    setMaxFPS(event.target.value);
  };

  const handleAudioEncoder = (event: React.FocusEvent<HTMLInputElement>) => {
    setAudioEncoder(event.target.value);
  };

  const handleAudioBufferSize = (event: React.FocusEvent<HTMLInputElement>) => {
    setAudioBufferSize(event.target.value);
  };

  const handleAudioBitrate = (event: React.FocusEvent<HTMLInputElement>) => {
    setAudioBitrate(event.target.value);
  };

  const handleAudioVolumePercent = (
    event: React.FocusEvent<HTMLInputElement>,
  ) => {
    setAudioVolumePercent(event.target.value);
  };

  const handleAudioChannels = (event: React.FocusEvent<HTMLInputElement>) => {
    setAudioChannels(event.target.value);
  };

  const handleAudioSampleRate = (event: React.FocusEvent<HTMLInputElement>) => {
    setAudioSampleRate(event.target.value);
  };

  const handleValidateFields = (event: React.FocusEvent<HTMLInputElement>) => {
    setShowFormError(!hasOnlyDigits(event.target.value));
  };

  const handleSnackClose = () => {
    setSnackStatus(false);
  };

  if (isPending || error) {
    return <div></div>;
  }

  const videoFfmpegSettings = () => {
    return (
      <>
        <TextField
          id="video-encoder"
          label="Video Encoder"
          value={videoEncoder}
          onChange={handleVideoEncoder}
          fullWidth
          sx={{ my: 1 }}
          helperText={`Some possible values are:
          h264 with Intel Quick Sync: h264_qsv
          MPEG2 with Intel Quick Sync: mpeg2_qsv
          NVIDIA: h264_nvenc
          MPEG2: mpeg2video (default)
          H264: libx264
          MacOS: h264_videotoolbox`}
        />
        <TextField
          id="video-bitrate"
          label="Video Bitrate"
          value={videoBitrate}
          onChange={handleVideoBitrate}
          fullWidth
          sx={{ my: 1 }}
        />
        <TextField
          id="video-buffer-size"
          label="Video Buffer Size"
          value={videoBufferSize}
          onChange={handleVideoBufferSize}
          fullWidth
          sx={{ my: 1 }}
        />
        <FormControl sx={{ mt: 2 }}>
          <InputLabel id="video-max-frame-rate-label">
            Max Frame Rate
          </InputLabel>
          <Select
            labelId="video-max-frame-rate-label"
            id="video-max-frame-rate"
            value={maxFPS}
            onChange={handleMaxFPS}
            fullWidth
            sx={{ my: 1 }}
            label="Max Frame Rate"
          >
            {supportedMaxFPS.map((fps) => (
              <MenuItem key={fps.value} value={fps.value}>
                {fps.string}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>
            Will transcode videos that have FPS higher than this.
          </FormHelperText>
        </FormControl>
        <FormControl sx={{ mt: 2 }}>
          <InputLabel id="video-scaling-algorithm-label">
            Scaling Algorithm
          </InputLabel>
          <Select
            labelId="video-scaling-algorithm-label"
            id="video-scaling-algorithm"
            value={scalingAlgorithm}
            onChange={(e) =>
              handleScalingAlgorithm(e.target.value as ScalingAlgorithmValue)
            }
            fullWidth
            sx={{ my: 1 }}
            label="Scaling Algorithm"
          >
            {supportedScalingAlgorithm.map((algorithm) => (
              <MenuItem key={algorithm} value={algorithm}>
                {algorithm}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>
            Scaling algorithm to use when the transcoder needs to change the
            video size.
          </FormHelperText>
        </FormControl>
        <FormControl sx={{ mt: 2 }}>
          <InputLabel id="video-deinterlace-filter-label">
            Deinterlace Filter
          </InputLabel>
          <Select
            labelId="video-deinterlace-filter-label"
            id="video-deinterlace-filter"
            value={deinterlaceFilter}
            onChange={(e) =>
              handleDeinterlaceFilter(e.target.value as DeinterlaceFilterValue)
            }
            fullWidth
            sx={{ my: 1 }}
            label="Scaling Algorithm"
          >
            {supportedDeinterlaceFilters.map((filter) => (
              <MenuItem key={filter.value} value={filter.value}>
                {filter.string}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>
            Deinterlace filter to use when video is interlaced. This is only
            needed when Plex transcoding is not used.
          </FormHelperText>
        </FormControl>
      </>
    );
  };

  const audioFfmpegSettings = () => {
    return (
      <>
        <TextField
          id="audioEncoder"
          label="Audio Encoder"
          value={audioEncoder}
          onChange={handleAudioEncoder}
          fullWidth
          sx={{ my: 1 }}
          helperText={`Some possible values are:
        aac
        ac3 (default), ac3_fixed
        flac
        libmp3lame`}
        />
        <TextField
          id="audio-bitrate"
          label="Audio Bitrate"
          value={audioBitrate}
          onChange={handleAudioBitrate}
          fullWidth
          sx={{ my: 1 }}
        />
        <TextField
          id="audio-buffer-size"
          label="Audio Buffer Size"
          value={audioBufferSize}
          onChange={handleAudioBufferSize}
          fullWidth
          sx={{ my: 1 }}
        />
        <TextField
          id="audio-volume"
          label="Audio Volume"
          value={audioVolumePercent}
          onChange={handleAudioVolumePercent}
          fullWidth
          sx={{ my: 1 }}
        />
        <TextField
          id="audio-channels"
          label="Audio Channels"
          value={audioChannels}
          onChange={handleAudioChannels}
          fullWidth
          sx={{ my: 1 }}
        />
        <TextField
          id="audio-sample-rate"
          label="Audio Sample Rate"
          value={audioSampleRate}
          onChange={handleAudioSampleRate}
          fullWidth
          sx={{ my: 1 }}
        />
      </>
    );
  };

  return (
    <>
      <Snackbar
        open={snackStatus}
        autoHideDuration={6000}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        onClose={handleSnackClose}
        message="Settings Saved!"
      />
      <FormControl fullWidth>
        <TextField
          id="executable-path"
          label="Executable Path"
          value={ffmpegExecutablePath}
          onChange={handleFfmpegExecutablePath}
          helperText={
            'FFMPEG version 4.2+ required. Check by opening the version tab'
          }
        />
      </FormControl>
      <Typography variant="h6" sx={{ my: 2 }}>
        Miscellaneous Options
      </Typography>
      {showFormError && (
        <Alert severity="error" sx={{ my: 2 }}>
          Invalid input. Please make sure number of threads is a number
        </Alert>
      )}
      <Stack spacing={2} direction={{ sm: 'column', md: 'row' }}>
        <TextField
          label="Threads"
          value={numThreads}
          onChange={handleNumThreads}
          onBlur={handleValidateFields}
        />
        <FormControlLabel
          control={
            <Checkbox checked={enableLogging} onChange={handleEnableLogging} />
          }
          label="Log FFMPEG to console"
        />
      </Stack>
      <FormControl sx={{ mt: 2 }}>
        <InputLabel id="video-concat-mux-delay-label">Video Buffer</InputLabel>
        <Select
          labelId="video-concat-mux-delay-label"
          id="video-concat-mux-delay"
          value={concatMuxDelay}
          onChange={handleConcatMuxDelay}
          label="Video Buffer"
        >
          {supportedVideoBuffer.map((buffer) => (
            <MenuItem key={buffer.value} value={buffer.value}>
              {buffer.string}
            </MenuItem>
          ))}
        </Select>
        <FormHelperText>
          Note: If you experience playback issues upon stream start, try
          increasing this.
        </FormHelperText>
      </FormControl>
      <Typography variant="h6" sx={{ my: 2 }}>
        Transcoding Features
      </Typography>
      <FormControl>
        <FormControlLabel
          control={
            <Checkbox
              checked={enableTranscoding}
              onChange={handleEnableTranscoding}
            />
          }
          label="Enable FFMPEG Transcoding"
        />
        <FormHelperText>
          Transcoding is required for some features like channel overlay and
          measures to prevent issues when switching episodes. The trade-off is
          quality loss and additional computing resource requirements.
        </FormHelperText>
      </FormControl>
      {enableTranscoding && (
        <Grid container spacing={2} columns={16}>
          <Grid item sm={16} md={8}>
            {videoFfmpegSettings()}
          </Grid>
          <Grid item sm={16} md={8}>
            {audioFfmpegSettings()}
          </Grid>
        </Grid>
      )}
      <Stack spacing={2} direction="row" justifyContent="right" sx={{ mt: 2 }}>
        <Button variant="outlined" onClick={() => handleResetOptions()}>
          Reset Options
        </Button>
        <Button
          variant="contained"
          disabled={showFormError}
          onClick={() => updateFfmpegSettings()}
        >
          Save
        </Button>
      </Stack>
    </>
  );
}
