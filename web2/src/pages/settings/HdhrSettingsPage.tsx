import {
  Box,
  Button,
  Checkbox,
  FormControl,
  FormLabel,
  FormControlLabel,
  FormHelperText,
  Paper,
  Stack,
  TextField,
} from '@mui/material';
import { useHdhrSettings } from '../../hooks/settingsHooks.ts';

export default function HdhrSettingsPage() {
  const { data, isPending, error } = useHdhrSettings();

  if (isPending) {
    return <h1>XML: Loading...</h1>;
  } else if (error) {
    return <h1>XML: {error.message}</h1>;
  }

  const defaultHdhrSettings = {
    enableSsdrServer: false,
    tuners: 2,
  };

  return (
    <>
      <Paper>
        <FormControl>
          <Checkbox />
          <FormLabel>Enable SSDP server</FormLabel>
          <FormHelperText>* Restart required</FormHelperText>
        </FormControl>
        <TextField
          fullWidth
          id="output-path"
          label="Tuner Count"
          defaultValue={'2'}
          InputProps={{ readOnly: true }}
          variant="filled"
          sx={{ mt: 2, mb: 2 }}
        />
      </Paper>
      <Stack spacing={2} direction="row" justifyContent="right" sx={{ mt: 2 }}>
        <Button variant="outlined">Reset Options</Button>
        <Button variant="contained">Save</Button>
      </Stack>
    </>
  );
}
