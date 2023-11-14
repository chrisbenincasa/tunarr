import { FormControl, TextField } from '@mui/material';
import { useFfmpegSettings } from '../../hooks/settingsHooks.ts';

export default function FfmpegSettingsPage() {
  const { data, isPending, error } = useFfmpegSettings();

  if (isPending || error) {
    return <div></div>;
  }

  return (
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
  );
}
