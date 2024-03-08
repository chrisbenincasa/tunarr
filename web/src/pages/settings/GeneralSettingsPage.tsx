import { Button, Stack } from '@mui/material';
import DarkModeButton from '../../components/settings/DarkModeButton.tsx';

export default function GeneralSettingsPage() {
  return (
    <>
      <DarkModeButton />
      <Stack spacing={2} direction="row" justifyContent="right" sx={{ mt: 2 }}>
        <Button variant="outlined">Reset Options</Button>
        <Button variant="contained">Save</Button>
      </Stack>
    </>
  );
}
