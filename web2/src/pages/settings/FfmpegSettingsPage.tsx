import React, { useEffect } from 'react';
import {
  Button,
  Checkbox,
  FormControl,
  FormHelperText,
  FormControlLabel,
  InputLabel,
  Link as MuiLink,
  MenuItem,
  Stack,
  Select,
  TextField,
  Typography,
  SelectChangeEvent,
  Alert,
  Snackbar,
  Grid,
  InputAdornment,
  IconButton,
  Tooltip,
} from '@mui/material';
import { useFfmpegSettings } from '../../hooks/settingsHooks.ts';
import { hasOnlyDigits } from '../../helpers/util.ts';
import { FfmpegSettings, defaultFfmpegSettings } from '@tunarr/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fromStringResolution,
  toStringResolution,
} from '../../helpers/util.ts';
import { HelpOutline } from '@mui/icons-material';

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

const supportedErrorScreens = [
  {
    value: 'pic',
    string: 'images/generic-error-screen.png',
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

const supportTargetResolution = [
  { value: '420x420', string: '420x420 (1:1)' },
  { value: '480x270', string: '480x270 (HD1080/16 16:9)' },
  { value: '576x320', string: '576x320 (18:10)' },
  { value: '640x360', string: '640x360 (nHD 16:9)' },
  { value: '720x480', string: '720x480 (WVGA 3:2)' },
  { value: '800x600', string: '800x600 (SVGA 4:3)' },
  { value: '1024x768', string: '1024x768 (WXGA 4:3)' },
  { value: '1280x720', string: '1280x720 (HD 16:9)' },
  { value: '1920x1080', string: '1920x1080 (FHD 16:9)' },
  { value: '3840x2160', string: '3840x2160 (4K 16:9)' },
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

  const [errorScreen, setErrorScreen] = React.useState<string>(
    defaultFfmpegSettings.errorScreen,
  );

  const [errorAudio, setErrorAudio] = React.useState<string>(
    defaultFfmpegSettings.errorAudio,
  );

  const [normalizeVideoCodec, setNormalizeVideoCodec] = React.useState<boolean>(
    defaultFfmpegSettings.normalizeVideoCodec,
  );

  const [normalizeAudioCodec, setNormalizeAudioCodec] = React.useState<boolean>(
    defaultFfmpegSettings.normalizeAudioCodec,
  );

  const [normalizeResolution, setNormalizeResolution] = React.useState<boolean>(
    defaultFfmpegSettings.normalizeResolution,
  );

  const [normalizeAudio, setNormalizeAudio] = React.useState<boolean>(
    defaultFfmpegSettings.normalizeAudio,
  );

  const [disableChannelOverlay, setDisableChannelOverlay] =
    React.useState<boolean>(defaultFfmpegSettings.disableChannelOverlay);

  const [disableChannelPrelude, setDisableChannelPrelude] =
    React.useState<boolean>(defaultFfmpegSettings.disableChannelPrelude);

  const [targetResolution, setTargetResolution] = React.useState<string>(
    toStringResolution(defaultFfmpegSettings.targetResolution),
  );

  const [showFormError, setShowFormError] = React.useState<boolean>(false);
  const queryClient = useQueryClient();

  const updateFfmpegSettingsMutation = useMutation({
    mutationFn: (updateSettings: FfmpegSettings) => {
      console.log(updateSettings);
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

  const updateFfmpegSettings = () => {
    const [h, w] = targetResolution.split('x', 2);

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
      targetResolution: fromStringResolution(
        toStringResolution({ widthPx: Number(w), heightPx: Number(h) }),
      ),
      videoBitrate: Number(videoBitrate),
      videoBufferSize: Number(videoBufferSize),
      audioBitrate: Number(audioBitrate),
      audioBufferSize: Number(audioBufferSize),
      audioSampleRate: Number(audioSampleRate),
      audioChannels: Number(audioChannels),
      errorScreen,
      errorAudio,
      normalizeVideoCodec,
      normalizeAudioCodec,
      normalizeResolution,
      normalizeAudio,
      maxFPS: Number(maxFPS),
      scalingAlgorithm,
      deinterlaceFilter,
      disableChannelOverlay,
      disableChannelPrelude,
    });
  };

  const handleResetOptions = () => {
    updateFfmpegSettingsMutation.mutate({
      ...defaultFfmpegSettings,
    });
    setFfmpegExecutablePath(defaultFfmpegSettings.ffmpegExecutablePath);
    setNumThreads(defaultFfmpegSettings.numThreads.toString());
    setEnableLogging(defaultFfmpegSettings.enableLogging);
    setConcatMuxDelay(defaultFfmpegSettings.concatMuxDelay.toString());
    setEnableTranscoding(defaultFfmpegSettings.enableTranscoding);
    setVideoEncoder(defaultFfmpegSettings.videoEncoder);
    setVideoBitrate(defaultFfmpegSettings.videoBitrate.toString());
    setVideoBufferSize(defaultFfmpegSettings.videoBufferSize.toString());
    setMaxFPS(defaultFfmpegSettings.maxFPS.toString());
    setScalingAlgorithm(defaultFfmpegSettings.scalingAlgorithm);
    setDeinterlaceFilter(defaultFfmpegSettings.deinterlaceFilter);
    setAudioEncoder(defaultFfmpegSettings.audioEncoder);
    setAudioBitrate(defaultFfmpegSettings.audioBitrate.toString());
    setAudioBufferSize(defaultFfmpegSettings.audioBufferSize.toString());
    setAudioVolumePercent(defaultFfmpegSettings.audioVolumePercent.toString());
    setAudioChannels(defaultFfmpegSettings.audioChannels.toString());
    setAudioSampleRate(defaultFfmpegSettings.audioSampleRate.toString());
    setErrorScreen(defaultFfmpegSettings.errorScreen);
    setErrorAudio(defaultFfmpegSettings.errorAudio);
    setNormalizeVideoCodec(defaultFfmpegSettings.normalizeVideoCodec);
    setNormalizeAudioCodec(defaultFfmpegSettings.normalizeAudioCodec);
    setNormalizeResolution(defaultFfmpegSettings.normalizeResolution);
    setNormalizeAudio(defaultFfmpegSettings.normalizeAudio);
    setDisableChannelOverlay(defaultFfmpegSettings.disableChannelOverlay);
    setDisableChannelPrelude(defaultFfmpegSettings.disableChannelPrelude);
    setTargetResolution(
      toStringResolution(defaultFfmpegSettings.targetResolution),
    );
  };

  useEffect(() => {
    setFfmpegExecutablePath(
      data?.ffmpegExecutablePath ?? defaultFfmpegSettings.ffmpegExecutablePath,
    );
    setNumThreads(
      data?.numThreads.toString() ??
        defaultFfmpegSettings.numThreads.toString(),
    );
    setEnableLogging(
      data?.enableLogging ?? defaultFfmpegSettings.enableLogging,
    );
    setConcatMuxDelay(
      data?.concatMuxDelay.toString() ??
        defaultFfmpegSettings.concatMuxDelay.toString(),
    );
    setEnableTranscoding(
      data?.enableTranscoding ?? defaultFfmpegSettings.enableTranscoding,
    );
    setVideoEncoder(data?.videoEncoder ?? defaultFfmpegSettings.videoEncoder);
    setVideoBitrate(
      data?.videoBitrate.toString() ??
        defaultFfmpegSettings.videoBitrate.toString(),
    );
    setVideoBufferSize(
      data?.videoBufferSize.toString() ??
        defaultFfmpegSettings.videoBufferSize.toString(),
    );
    setMaxFPS(
      data?.maxFPS.toString() ?? defaultFfmpegSettings.maxFPS.toString(),
    );
    setScalingAlgorithm(
      data?.scalingAlgorithm ?? defaultFfmpegSettings.scalingAlgorithm,
    );
    setDeinterlaceFilter(
      data?.deinterlaceFilter ?? defaultFfmpegSettings.deinterlaceFilter,
    );
    setAudioEncoder(data?.audioEncoder ?? defaultFfmpegSettings.audioEncoder);
    setAudioBitrate(
      data?.audioBitrate.toString() ??
        defaultFfmpegSettings.audioBitrate.toString(),
    );
    setAudioBufferSize(
      data?.audioBufferSize.toString() ??
        defaultFfmpegSettings.audioBufferSize.toString(),
    );
    setAudioVolumePercent(
      data?.audioVolumePercent.toString() ??
        defaultFfmpegSettings.audioVolumePercent.toString(),
    );
    setAudioChannels(
      data?.audioChannels.toString() ??
        defaultFfmpegSettings.audioChannels.toString(),
    );
    setAudioSampleRate(
      data?.audioSampleRate.toString() ??
        defaultFfmpegSettings.audioSampleRate.toString(),
    );
    setErrorScreen(data?.errorScreen ?? defaultFfmpegSettings.errorScreen);
    setErrorAudio(data?.errorAudio ?? defaultFfmpegSettings.errorAudio);
    setNormalizeVideoCodec(
      data?.normalizeVideoCodec ?? defaultFfmpegSettings.normalizeVideoCodec,
    );
    setNormalizeAudioCodec(
      data?.normalizeAudioCodec ?? defaultFfmpegSettings.normalizeAudioCodec,
    );
    setNormalizeResolution(
      data?.normalizeResolution ?? defaultFfmpegSettings.normalizeResolution,
    );
    setNormalizeAudio(
      data?.normalizeAudio ?? defaultFfmpegSettings.normalizeAudio,
    );
    setDisableChannelOverlay(
      data?.disableChannelOverlay ??
        defaultFfmpegSettings.disableChannelOverlay,
    );
    setDisableChannelPrelude(
      data?.disableChannelPrelude ??
        defaultFfmpegSettings.disableChannelPrelude,
    );
    setTargetResolution(
      toStringResolution(
        data?.targetResolution ?? defaultFfmpegSettings.targetResolution,
      ),
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

  const handlErrorScreen = (event: SelectChangeEvent<string>) => {
    setErrorScreen(event.target.value);
  };

  const handlErrorAudio = (event: SelectChangeEvent<string>) => {
    setErrorAudio(event.target.value);
  };

  const handleNormalizeVideoCodec = () => {
    setNormalizeVideoCodec(!normalizeVideoCodec);
  };

  const handleNormalizeAudioCodec = () => {
    console.log(normalizeAudioCodec);
    setNormalizeAudioCodec(!normalizeAudioCodec);
  };

  const handleNormalizeResolution = () => {
    setNormalizeResolution(!normalizeResolution);
  };

  const handleNormalizeAudio = () => {
    setNormalizeAudio(!normalizeAudio);
  };

  const handleDisableChannelOverlay = () => {
    setDisableChannelOverlay(!disableChannelOverlay);
  };

  const HandleDisableChannelPrelude = () => {
    setDisableChannelPrelude(!disableChannelPrelude);
  };

  const handleTargetResolution = (event: SelectChangeEvent<string>) => {
    setTargetResolution(event.target.value);
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
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <Tooltip
                  title="Some possible values are:
          h264 with Intel Quick Sync: h264_qsv
          MPEG2 with Intel Quick Sync: mpeg2_qsv
          NVIDIA: h264_nvenc
          MPEG2: mpeg2video (default)
          H264: libx264
          MacOS: h264_videotoolbox"
                >
                  <IconButton
                    aria-label="Some possible values are:
          h264 with Intel Quick Sync: h264_qsv
          MPEG2 with Intel Quick Sync: mpeg2_qsv
          NVIDIA: h264_nvenc
          MPEG2: mpeg2video (default)
          H264: libx264
          MacOS: h264_videotoolbox"
                    edge="end"
                  >
                    <HelpOutline sx={{ opacity: 0.75 }} />
                  </IconButton>
                </Tooltip>
              </InputAdornment>
            ),
          }}
        />
        <Grid container columns={{ sm: 8, md: 16 }} columnSpacing={2}>
          <Grid item sm={16} md={8}>
            <TextField
              id="video-bitrate"
              label="Video Bitrate (Kbps)"
              value={videoBitrate}
              onChange={handleVideoBitrate}
              fullWidth
              sx={{ my: 1 }}
            />
          </Grid>
          <Grid item sm={16} md={8}>
            <TextField
              id="video-buffer-size"
              label="Video Buffer Size (kb)"
              value={videoBufferSize}
              onChange={handleVideoBufferSize}
              fullWidth
              sx={{ my: 1 }}
              helperText={
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
              }
            />
          </Grid>
        </Grid>
        <FormControl sx={{ mt: 2 }} fullWidth>
          <InputLabel id="video-max-frame-rate-label">
            Max Frame Rate
          </InputLabel>
          <Select
            labelId="video-max-frame-rate-label"
            id="video-max-frame-rate"
            value={maxFPS}
            onChange={handleMaxFPS}
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
        <FormControl sx={{ mt: 2 }} fullWidth>
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
        <FormControl sx={{ mt: 2 }} fullWidth>
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
        <FormControl sx={{ mt: 2 }} fullWidth>
          <InputLabel id="target-resolution-label">
            Preferred Resolution
          </InputLabel>
          <Select
            labelId="target-resolution-label"
            id="target-resolution"
            value={targetResolution}
            onChange={handleTargetResolution}
            sx={{ my: 1 }}
            label="Preferred Resolution"
          >
            {supportTargetResolution.map((resolution) => (
              <MenuItem key={resolution.value} value={resolution.value}>
                {resolution.string}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl fullWidth>
          <FormControlLabel
            control={
              <Checkbox
                checked={normalizeResolution}
                onChange={handleNormalizeResolution}
              />
            }
            label="Normalize Resolution"
          />
          <FormHelperText>
            Some clients experience issues when the video stream changes
            resolution. This option will make dizqueTV convert all videos to the
            preferred resolution selected above. Otherwise, the preferred
            resolution will be used as a maximum resolution for transcoding.
          </FormHelperText>
        </FormControl>
        <FormControl>
          <FormControlLabel
            control={
              <Checkbox
                checked={normalizeVideoCodec}
                onChange={handleNormalizeVideoCodec}
              />
            }
            label="Normalize Video Codec"
          />
          <FormHelperText>
            Some clients experience issues when the stream's codecs change.
            Enable these so that any videos with different codecs than the ones
            specified above are forcefully transcoded.
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
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <Tooltip
                  title="Some possible values are:
                  aac
                  ac3 (default), ac3_fixed
                  flac
                  libmp3lame"
                >
                  <IconButton
                    aria-label="Some possible values are:
                    aac
                    ac3 (default), ac3_fixed
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
        <Grid container columns={{ sm: 8, md: 16 }} columnSpacing={2}>
          <Grid item sm={16} md={8}>
            <TextField
              id="audio-bitrate"
              label="Audio Bitrate (Kbps)"
              value={audioBitrate}
              onChange={handleAudioBitrate}
              sx={{ my: 1 }}
              fullWidth
            />
          </Grid>
          <Grid item sm={16} md={8}>
            <TextField
              id="audio-buffer-size"
              label="Audio Buffer Size (kb)"
              value={audioBufferSize}
              onChange={handleAudioBufferSize}
              sx={{ my: 1 }}
              fullWidth
            />
          </Grid>
        </Grid>
        <Grid container columns={{ sm: 8, md: 16 }} columnSpacing={2}>
          <Grid item sm={16} md={8}>
            <TextField
              id="audio-volume"
              label="Audio Volume"
              value={audioVolumePercent}
              onChange={handleAudioVolumePercent}
              fullWidth
              sx={{ my: 1 }}
              helperText={'Values higher than 100 will boost the audio.'}
              InputProps={{
                endAdornment: <InputAdornment position="end">%</InputAdornment>,
              }}
            />
          </Grid>
          <Grid item sm={16} md={8}>
            <TextField
              id="audio-channels"
              label="Audio Channels"
              value={audioChannels}
              onChange={handleAudioChannels}
              fullWidth
              sx={{ my: 1 }}
            />
          </Grid>
        </Grid>
        <TextField
          id="audio-sample-rate"
          label="Audio Sample Rate (k)"
          value={audioSampleRate}
          onChange={handleAudioSampleRate}
          fullWidth
          sx={{ my: 1 }}
        />
        <FormControl fullWidth>
          <FormControlLabel
            control={
              <Checkbox
                checked={normalizeAudioCodec}
                onChange={handleNormalizeAudioCodec}
              />
            }
            label="Normalize Audio Codec"
          />
        </FormControl>

        <FormControl fullWidth>
          <FormControlLabel
            control={
              <Checkbox
                checked={normalizeAudio}
                onChange={handleNormalizeAudio}
              />
            }
            label="Normalize Audio"
          />
          <FormHelperText>
            This will force the preferred number of audio channels and sample
            rate, in addition it will align the lengths of the audio and video
            channels. This will prevent audio-related episode transition issues
            in many clients. Audio will always be transcoded.
          </FormHelperText>
        </FormControl>
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
        <>
          <Grid container spacing={2} columns={16}>
            <Grid item sm={16} md={8}>
              <Typography component="h6" variant="h6" sx={{ pt: 2, pb: 1 }}>
                Video Options
              </Typography>
              {videoFfmpegSettings()}
            </Grid>
            <Grid item sm={16} md={8}>
              <Typography component="h6" variant="h6" sx={{ pt: 2, pb: 1 }}>
                Audio Options
              </Typography>
              {audioFfmpegSettings()}
            </Grid>
          </Grid>

          <Typography component="h6" variant="h6" sx={{ pt: 2, pb: 1 }}>
            Error Options
          </Typography>
          <Grid container spacing={2} columns={16}>
            <Grid item sm={16} md={8}>
              <FormControl sx={{ mt: 2 }}>
                <InputLabel id="error-screen-label">Error Screen</InputLabel>
                <Select
                  labelId="error-screen-label"
                  id="error-screen"
                  value={errorScreen}
                  onChange={handlErrorScreen}
                  label="Error Screen"
                >
                  {supportedErrorScreens.map((error) => (
                    <MenuItem key={error.value} value={error.value}>
                      {error.string}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  If there are issues playing a video, dizqueTV will try to use
                  an error screen as a placeholder while retrying loading the
                  video every 60 seconds.
                </FormHelperText>
              </FormControl>
            </Grid>
            <Grid item sm={16} md={8}>
              <FormControl sx={{ mt: 2 }}>
                <InputLabel id="error-audio-label">Error Audio</InputLabel>
                <Select
                  labelId="error-audio-label"
                  id="error-screen"
                  value={errorAudio}
                  onChange={handlErrorAudio}
                  label="Error Audio"
                >
                  {supportedErrorAudio.map((error) => (
                    <MenuItem key={error.value} value={error.value}>
                      {error.string}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          <Typography component="h6" variant="h6" sx={{ pt: 2, pb: 1 }}>
            Misc Options
          </Typography>

          <FormControl fullWidth>
            <FormControlLabel
              control={
                <Checkbox
                  checked={disableChannelOverlay}
                  onChange={handleDisableChannelOverlay}
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
                <Checkbox
                  checked={disableChannelPrelude}
                  onChange={HandleDisableChannelPrelude}
                />
              }
              label="Disable Channel Prelude"
            />
            <FormHelperText>
              In an attempt to improve playback, dizqueTV insets really short
              clips of black screen between videos. The idea is that if the
              stream pauses because Plex is taking too long to reply, it will
              pause during one of those black screens instead of interrupting
              the last second of a video. If you suspect these black screens are
              causing trouble instead of helping, you can disable them with this
              option.
            </FormHelperText>
          </FormControl>
        </>
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
