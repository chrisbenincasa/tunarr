import { Button, Stack } from '@mui/material';

export default function GeneralSettingsPage() {
  return (
    <>
      <Stack spacing={2} direction="row" justifyContent="right" sx={{ mt: 2 }}>
        <Button variant="outlined">Reset Options</Button>
        <Button variant="contained">Save</Button>
      </Stack>
    </>
  );
}
