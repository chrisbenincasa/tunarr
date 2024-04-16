import DarkModeButton from '../../components/settings/DarkModeButton.tsx';

export default function GeneralSettingsPage() {
  return (
    <>
      <DarkModeButton />
      {/* This is currently not needed for this page as Dark Mode saves automatically */}
      {/* <Stack spacing={2} direction="row" justifyContent="right" sx={{ mt: 2 }}>
        <Button variant="outlined">Reset Options</Button>
        <Button variant="contained">Save</Button>
      </Stack> */}
    </>
  );
}
