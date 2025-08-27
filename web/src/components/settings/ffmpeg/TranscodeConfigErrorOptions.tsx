import {
  FormControl,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Select,
} from '@mui/material';
import type { TranscodeConfig } from '@tunarr/types';
import { Controller, useFormContext } from 'react-hook-form';

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

export const TranscodeConfigErrorOptions = () => {
  const { control } = useFormContext<TranscodeConfig>();

  return (
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
            If there are issues playing a video, Tunarr will try to use an error
            screen as a placeholder while retrying loading the video every 60
            seconds.
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
  );
};
