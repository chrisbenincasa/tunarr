import {
  Button,
  Checkbox,
  FormControl,
  FormHelperText,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Stack,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { useFfmpegSettings } from '../../hooks/settingsHooks.ts';

export default function FfmpegSettingsPage() {
  const { data, isPending, error } = useFfmpegSettings();

  if (isPending || error) {
    return <div></div>;
  }

  const defaultFFMPEGSettings = {
    ffmpegExecutablePath: '/usr/bin/ffmpeg',
    numThreads: 4,
    enableLogging: false,
    videoBufferSize: 0,
    enableTranscoding: false,
  };

  return (
    <>
      <Paper>
        <FormControl fullWidth>
          <TextField
            id="executable-path"
            label="Executable Path"
            defaultValue={data.ffmpegExecutablePath}
            helperText={
              'FFMPEG version 4.2+ required. Check by opening the version tab'
            }
          />
        </FormControl>
        <Typography variant="h6" sx={{ my: 2 }}>
          Miscellaneous Options
        </Typography>
        <Stack spacing={2} direction={{ sm: 'column', md: 'row' }}>
          <TextField label="Threads" defaultValue={data.numThreads} />
          <FormControlLabel
            control={<Checkbox />}
            label="Log FFMPEG to console"
          />
        </Stack>
        <FormControl sx={{ mt: 2 }}>
          <InputLabel id="video-buffer-size-label">Video Buffer</InputLabel>
          <Select
            labelId="video-buffer-size-label"
            id="video-buffer-size"
            value={data.videoBufferSize}
            label="Video Buffer"
          >
            <MenuItem value={0}>0 Seconds</MenuItem>
            <MenuItem value={1000}>1 Second</MenuItem>
            <MenuItem value={2000}>2 Seconds</MenuItem>
            <MenuItem value={3000}>3 Seconds</MenuItem>
            <MenuItem value={4000}>4 Seconds</MenuItem>
            <MenuItem value={5000}>5 Seconds</MenuItem>
            <MenuItem value={10000}>10 Seconds</MenuItem>
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
            control={<Checkbox />}
            label="Enable FFMPEG Transcoding"
          />
          <FormHelperText>
            Transcoding is required for some features like channel overlay and
            measures to prevent issues when switching episodes. The trade-off is
            quality loss and additional computing resource requirements.
          </FormHelperText>
        </FormControl>
      </Paper>
      <Stack spacing={2} direction="row" justifyContent="right" sx={{ mt: 2 }}>
        <Button variant="outlined">Reset Options</Button>
        <Button variant="contained">Save</Button>
      </Stack>
    </>
  );
}
