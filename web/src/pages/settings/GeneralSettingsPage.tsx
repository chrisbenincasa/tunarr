import { Button, FormControlLabel, Stack, Switch } from '@mui/material';
import useStore from '../../store/index.ts';
import { setDarkModeState } from '../../store/themeEditor/actions.ts';

export default function GeneralSettingsPage() {
  const darkMode = useStore((state) => state.theme.darkMode);

  return (
    <>
      {/* <DarkModeButton /> */}
      <FormControlLabel
        control={
          <Switch checked={darkMode} onClick={() => setDarkModeState()} />
        }
        label="Dark Mode"
      />
      <Stack spacing={2} direction="row" justifyContent="right" sx={{ mt: 2 }}>
        <Button variant="outlined">Reset Options</Button>
        <Button variant="contained">Save</Button>
      </Stack>
    </>
  );
}
