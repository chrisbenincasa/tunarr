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

export default function FfmpegSettingsPage() {
  const { data, isPending, error } = useFfmpegSettings();
  const [snackStatus, setSnackStatus] = React.useState<boolean>(false);

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

  // TO DO: Add All Fields and remove defaults
  // refactor
  const updateFfmpegSettings = () => {
    updateFfmpegSettingsMutation.mutate({
      configVersion: defaultFfmpegSettings.configVersion,
      ffmpegExecutablePath,
      numThreads: Number(numThreads),
      concatMuxDelay: defaultFfmpegSettings.concatMuxDelay,
      enableLogging,
      enableTranscoding,
      audioVolumePercent: defaultFfmpegSettings.audioVolumePercent,
      videoEncoder: defaultFfmpegSettings.videoEncoder,
      audioEncoder: defaultFfmpegSettings.audioEncoder,
      targetResolution: defaultFfmpegSettings.targetResolution,
      videoBitrate: defaultFfmpegSettings.videoBitrate,
      videoBufferSize: Number(videoBufferSize),
      audioBitrate: defaultFfmpegSettings.audioBitrate,
      audioBufferSize: defaultFfmpegSettings.audioBufferSize,
      audioSampleRate: defaultFfmpegSettings.audioSampleRate,
      audioChannels: defaultFfmpegSettings.audioChannels,
      errorScreen: defaultFfmpegSettings.errorScreen,
      errorAudio: defaultFfmpegSettings.errorAudio,
      normalizeVideoCodec: defaultFfmpegSettings.normalizeVideoCodec,
      normalizeAudioCodec: defaultFfmpegSettings.normalizeAudioCodec,
      normalizeResolution: defaultFfmpegSettings.normalizeResolution,
      normalizeAudio: defaultFfmpegSettings.normalizeAudio,
      maxFPS: defaultFfmpegSettings.maxFPS,
      scalingAlgorithm: defaultFfmpegSettings.scalingAlgorithm,
      deinterlaceFilter: defaultFfmpegSettings.deinterlaceFilter,
      disableChannelOverlay: defaultFfmpegSettings.disableChannelOverlay,
    });
  };

  const handleResetOptions = () => {
    updateFfmpegSettingsMutation.mutate({
      configVersion: defaultFfmpegSettings.configVersion,
      ffmpegExecutablePath: defaultFfmpegSettings.ffmpegExecutablePath,
      numThreads: defaultFfmpegSettings.numThreads,
      concatMuxDelay: defaultFfmpegSettings.concatMuxDelay,
      enableLogging: defaultFfmpegSettings.enableLogging,
      enableTranscoding: defaultFfmpegSettings.enableTranscoding,
      audioVolumePercent: defaultFfmpegSettings.audioVolumePercent,
      videoEncoder: defaultFfmpegSettings.videoEncoder,
      audioEncoder: defaultFfmpegSettings.audioEncoder,
      targetResolution: defaultFfmpegSettings.targetResolution,
      videoBitrate: defaultFfmpegSettings.videoBitrate,
      videoBufferSize: defaultFfmpegSettings.videoBufferSize,
      audioBitrate: defaultFfmpegSettings.audioBitrate,
      audioBufferSize: defaultFfmpegSettings.audioBufferSize,
      audioSampleRate: defaultFfmpegSettings.audioSampleRate,
      audioChannels: defaultFfmpegSettings.audioChannels,
      errorScreen: defaultFfmpegSettings.errorScreen,
      errorAudio: defaultFfmpegSettings.errorAudio,
      normalizeVideoCodec: defaultFfmpegSettings.normalizeVideoCodec,
      normalizeAudioCodec: defaultFfmpegSettings.normalizeAudioCodec,
      normalizeResolution: defaultFfmpegSettings.normalizeResolution,
      normalizeAudio: defaultFfmpegSettings.normalizeAudio,
      maxFPS: defaultFfmpegSettings.maxFPS,
      scalingAlgorithm: defaultFfmpegSettings.scalingAlgorithm,
      deinterlaceFilter: defaultFfmpegSettings.deinterlaceFilter,
      disableChannelOverlay: defaultFfmpegSettings.disableChannelOverlay,
    });
    setFfmpegExecutablePath(defaultFfmpegSettings.ffmpegExecutablePath);
    setNumThreads(defaultFfmpegSettings.numThreads.toString());
    setEnableLogging(defaultFfmpegSettings.enableLogging);
    setVideoBufferSize(defaultFfmpegSettings.videoBufferSize.toString());
    setEnableTranscoding(defaultFfmpegSettings.enableLogging);
  };

  const [ffmpegExecutablePath, setFfmpegExecutablePath] =
    React.useState<string>(defaultFfmpegSettings.ffmpegExecutablePath);

  const [numThreads, setNumThreads] = React.useState<string>(
    defaultFfmpegSettings.numThreads.toString(),
  );

  const [enableLogging, setEnableLogging] = React.useState<boolean>(
    defaultFfmpegSettings.enableLogging,
  );

  const [videoBufferSize, setVideoBufferSize] = React.useState<string>(
    defaultFfmpegSettings.videoBufferSize.toString(),
  );

  const [enableTranscoding, setEnableTranscoding] = React.useState<boolean>(
    defaultFfmpegSettings.enableTranscoding,
  );

  const [showFormError, setShowFormError] = React.useState<boolean>(false);

  useEffect(() => {
    setFfmpegExecutablePath(
      data?.ffmpegExecutablePath || defaultFfmpegSettings.ffmpegExecutablePath,
    );

    setNumThreads(
      data?.numThreads.toString() ||
        defaultFfmpegSettings.numThreads.toString(),
    );

    setEnableLogging(
      data?.enableLogging || defaultFfmpegSettings.enableLogging,
    );

    setVideoBufferSize(
      data?.videoBufferSize.toString() ||
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

  const handleVideoBufferSize = (event: SelectChangeEvent<string>) => {
    setVideoBufferSize(event.target.value);
  };

  const handleEnableTranscoding = () => {
    setEnableTranscoding(!enableTranscoding);
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
        <InputLabel id="video-buffer-size-label">Video Buffer</InputLabel>
        <Select
          labelId="video-buffer-size-label"
          id="video-buffer-size"
          value={videoBufferSize}
          onChange={handleVideoBufferSize}
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
