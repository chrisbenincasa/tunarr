import { Box, TextField } from '@mui/material';
import { useXmlTvSettings } from '../../hooks/settingsHooks.ts';

export default function XmlTvSettingsPage() {
  const { data, isPending, error } = useXmlTvSettings();

  if (isPending) {
    return <h1>XML: Loading...</h1>;
  } else if (error) {
    return <h1>XML: {error.message}</h1>;
  }

  return (
    <Box>
      <TextField
        fullWidth
        id="output-path"
        label="Output Path"
        defaultValue={data.outputPath}
        InputProps={{ readOnly: true }}
        variant="filled"
        sx={{ mt: 2, mb: 2 }}
      />
      <TextField
        fullWidth
        label="Refresh Hours"
        variant="filled"
        defaultValue={data.refreshHours}
      />
    </Box>
  );
}
