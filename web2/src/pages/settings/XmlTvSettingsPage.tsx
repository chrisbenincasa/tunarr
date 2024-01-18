import {
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Paper,
  Stack,
  TextField,
} from '@mui/material';
import { useXmlTvSettings } from '../../hooks/settingsHooks.ts';

export default function XmlTvSettingsPage() {
  const { data, isPending, error } = useXmlTvSettings();

  if (isPending) {
    return <h1>XML: Loading...</h1>;
  } else if (error) {
    return <h1>XML: {error.message}</h1>;
  }

  const defaultXMLTVSettings = {
    programmingHours: 12,
    refreshHours: 4,
    enableImageCache: false,
  };

  return (
    <>
      <Paper>
        <TextField
          fullWidth
          id="output-path"
          label="Output Path"
          defaultValue={data.outputPath}
          InputProps={{ readOnly: true }}
          variant="filled"
          margin="normal"
          sx={{ mt: 0 }}
          helperText="You can edit this location in file xmltv-settings.json."
        />
        <Stack
          sx={{ mt: 1, mb: 1 }}
          spacing={2}
          direction={{ sm: 'column', md: 'row' }}
        >
          <TextField
            fullWidth
            label="EPG (Hours)"
            defaultValue={data.programmingHours}
            helperText="How many hours of programming to include in the xmltv file."
          />
          <TextField
            fullWidth
            label="Refresh Timer (Hours)"
            defaultValue={data.refreshHours}
            helperText="How often should the xmltv file be updated."
          />
        </Stack>
        <FormControl>
          <FormControlLabel control={<Checkbox />} label="Image Cache" />
          <FormHelperText>
            If enabled the pictures used for Movie and TV Show posters will be
            cached in dizqueTV's .dizqueTV folder and will be delivered by
            dizqueTV's server instead of requiring calls to Plex. Note that
            using fixed xmltv location in Plex (as opposed to url) will not work
            correctly in this case.
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
