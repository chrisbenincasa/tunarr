import React, { useEffect } from 'React';
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
} from '@mui/material';
import { useFfmpegSettings } from '../../hooks/settingsHooks.ts';
import { hasOnlyDigits } from '../../helpers/util.ts';

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

  const defaultFFMPEGSettings = {
    ffmpegExecutablePath: '/usr/bin/ffmpeg',
    numThreads: 4,
    enableLogging: false,
    videoBufferSize: 0,
    enableTranscoding: false,
  };

  const [ffmpegExecutablePath, setFfmpegExecutablePath] =
    React.useState<string>(defaultFFMPEGSettings.ffmpegExecutablePath);

  const [numThreads, setNumThreads] = React.useState<string>(
    defaultFFMPEGSettings.numThreads.toString(),
  );

  const [enableLogging, setEnableLogging] = React.useState<boolean>(
    defaultFFMPEGSettings.enableLogging,
  );

  const [videoBufferSize, setVideoBufferSize] = React.useState<string>(
    defaultFFMPEGSettings.videoBufferSize.toString(),
  );

  const [enableTranscoding, setEnableTranscoding] = React.useState<boolean>(
    defaultFFMPEGSettings.enableTranscoding,
  );

  const [showFormError, setShowFormError] = React.useState<boolean>(false);

  useEffect(() => {
    setFfmpegExecutablePath(
      data?.ffmpegExecutablePath || defaultFFMPEGSettings.ffmpegExecutablePath,
    );

    setNumThreads(
      data?.numThreads.toString() ||
        defaultFFMPEGSettings.numThreads.toString(),
    );

    setEnableLogging(
      data?.enableLogging || defaultFFMPEGSettings.enableLogging,
    );

    setVideoBufferSize(
      data?.videoBufferSize.toString() ||
        defaultFFMPEGSettings.videoBufferSize.toString(),
    );

    setEnableTranscoding(
      data?.enableTranscoding || defaultFFMPEGSettings.enableTranscoding,
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

  if (isPending || error) {
    return <div></div>;
  }

  return (
    <>
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
        <Button variant="outlined">Reset Options</Button>
        <Button variant="contained" disabled={showFormError}>
          Save
        </Button>
      </Stack>
    </>
  );
}
