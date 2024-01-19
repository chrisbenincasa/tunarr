import React, { useEffect } from 'react';
import {
  Alert,
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
import { hasOnlyDigits } from '../../helpers/util.ts';

export default function XmlTvSettingsPage() {
  const { data, isPending, error } = useXmlTvSettings();

  const defaultXMLTVSettings = {
    outputPath: '',
    programmingHours: 12,
    refreshHours: 4,
    enableImageCache: false,
  };

  const [outputPath, setOutputPath] = React.useState<string>(
    defaultXMLTVSettings.outputPath,
  );

  const [programmingHours, setProgrammingHours] = React.useState<string>(
    defaultXMLTVSettings.programmingHours.toString(),
  );

  const [refreshHours, setRefreshHours] = React.useState<string>(
    defaultXMLTVSettings.refreshHours.toString(),
  );

  const [enableImageCache, setEnableImageCache] = React.useState<boolean>(
    defaultXMLTVSettings.enableImageCache,
  );

  const [showFormError, setShowFormError] = React.useState<boolean>(false);

  useEffect(() => {
    setOutputPath(data?.outputPath || defaultXMLTVSettings.outputPath);
    setProgrammingHours(
      data?.programmingHours.toString() ||
        defaultXMLTVSettings.programmingHours.toString(),
    );
    setRefreshHours(
      data?.refreshHours.toString() ||
        defaultXMLTVSettings.refreshHours.toString(),
    );
    setEnableImageCache(
      data?.enableImageCache || defaultXMLTVSettings.enableImageCache,
    );
  }, [data]);

  const handleProgrammingHours = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setProgrammingHours(event.target.value);
  };

  const handleRefreshHours = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRefreshHours(event.target.value);
  };

  const handleEnableImageCache = () => {
    setEnableImageCache(!!enableImageCache);
  };

  const handleValidateFields = (event: React.FocusEvent<HTMLInputElement>) => {
    setShowFormError(!hasOnlyDigits(event.target.value));
  };

  if (isPending) {
    return <h1>XML: Loading...</h1>;
  } else if (error) {
    return <h1>XML: {error.message}</h1>;
  }

  return (
    <>
      <Paper>
        <TextField
          fullWidth
          id="output-path"
          label="Output Path"
          value={outputPath}
          InputProps={{ readOnly: true }}
          variant="filled"
          margin="normal"
          sx={{ mt: 2, mb: 2 }}
          helperText="You can edit this location in file xmltv-settings.json."
        />
        {showFormError && (
          <Alert severity="error" sx={{ my: 2 }}>
            Invalid input. Please make sure EPG Hours & Refresh Timer is a
            number
          </Alert>
        )}
        <Stack spacing={2} direction={{ sm: 'column', md: 'row' }}>
          <TextField
            fullWidth
            label="EPG (Hours)"
            value={programmingHours}
            onChange={handleProgrammingHours}
            onBlur={handleValidateFields}
            helperText="How many hours of programming to include in the xmltv file."
          />
          <TextField
            fullWidth
            label="Refresh Timer (Hours)"
            value={refreshHours}
            onChange={handleRefreshHours}
            onBlur={handleValidateFields}
            helperText="How often should the xmltv file be updated."
          />
        </Stack>
        <FormControl>
          <FormControlLabel
            control={
              <Checkbox
                checked={enableImageCache}
                onChange={handleEnableImageCache}
              />
            }
            label="Image Cache"
          />
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
        <Button variant="contained" disabled={showFormError}>
          Save
        </Button>
      </Stack>
    </>
  );
}
