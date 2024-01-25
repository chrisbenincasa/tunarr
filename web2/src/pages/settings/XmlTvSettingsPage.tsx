import React, { useEffect } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Snackbar,
  Stack,
  TextField,
} from '@mui/material';
import { useXmlTvSettings } from '../../hooks/settingsHooks.ts';
import { hasOnlyDigits } from '../../helpers/util.ts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { XmlTvSettings, defaultXmlTvSettings } from '@tunarr/types';

export default function XmlTvSettingsPage() {
  const { data, isPending, error } = useXmlTvSettings();

  const queryClient = useQueryClient();

  const updateXmlTvSettingsMutation = useMutation({
    mutationFn: (updateSettings: XmlTvSettings) => {
      return fetch('http://localhost:8000/api/xmltv-settings', {
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
        queryKey: ['settings', 'xmltv-settings'],
      });
    },
  });

  const updateXmlTvSettings = () => {
    updateXmlTvSettingsMutation.mutate({
      programmingHours: Number(programmingHours),
      refreshHours: Number(refreshHours),
      outputPath,
      enableImageCache,
    });
  };

  const handleResetOptions = () => {
    updateXmlTvSettingsMutation.mutate({
      programmingHours: defaultXmlTvSettings.programmingHours,
      refreshHours: defaultXmlTvSettings.refreshHours,
      outputPath: defaultXmlTvSettings.outputPath,
      enableImageCache: defaultXmlTvSettings.enableImageCache,
    });
    setProgrammingHours(defaultXmlTvSettings.programmingHours.toString());
    setRefreshHours(defaultXmlTvSettings.refreshHours.toString());
    setEnableImageCache(defaultXmlTvSettings.enableImageCache);
  };

  const [outputPath, setOutputPath] = React.useState<string>(
    defaultXmlTvSettings.outputPath,
  );

  const [programmingHours, setProgrammingHours] = React.useState<string>(
    defaultXmlTvSettings.programmingHours.toString(),
  );

  const [refreshHours, setRefreshHours] = React.useState<string>(
    defaultXmlTvSettings.refreshHours.toString(),
  );

  const [enableImageCache, setEnableImageCache] = React.useState<boolean>(
    defaultXmlTvSettings.enableImageCache,
  );

  const [showFormError, setShowFormError] = React.useState<boolean>(false);

  const [snackStatus, setSnackStatus] = React.useState<boolean>(false);

  useEffect(() => {
    setOutputPath(data?.outputPath || defaultXmlTvSettings.outputPath);
    defaultXmlTvSettings.outputPath =
      data?.outputPath || defaultXmlTvSettings.outputPath;

    setProgrammingHours(
      data?.programmingHours.toString() ||
        defaultXmlTvSettings.programmingHours.toString(),
    );

    setRefreshHours(
      data?.refreshHours.toString() ||
        defaultXmlTvSettings.refreshHours.toString(),
    );

    setEnableImageCache(
      data?.enableImageCache || defaultXmlTvSettings.enableImageCache,
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
    setEnableImageCache(!enableImageCache);
  };

  const handleValidateFields = (event: React.FocusEvent<HTMLInputElement>) => {
    setShowFormError(!hasOnlyDigits(event.target.value));
  };

  const handleSnackClose = () => {
    setSnackStatus(false);
  };

  if (isPending) {
    return <h1>XML: Loading...</h1>;
  } else if (error) {
    return <h1>XML: {error.message}</h1>;
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
          Invalid input. Please make sure EPG Hours & Refresh Timer is a number
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
          dizqueTV's server instead of requiring calls to Plex. Note that using
          fixed xmltv location in Plex (as opposed to url) will not work
          correctly in this case.
        </FormHelperText>
      </FormControl>
      <Stack spacing={2} direction="row" justifyContent="right" sx={{ mt: 2 }}>
        <Button variant="outlined" onClick={() => handleResetOptions()}>
          Reset Options
        </Button>
        <Button
          variant="contained"
          disabled={showFormError}
          onClick={() => updateXmlTvSettings()}
        >
          Save
        </Button>
      </Stack>
    </>
  );
}
