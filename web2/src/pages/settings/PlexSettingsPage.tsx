import { FormControl } from '@mui/material';
import { usePlexSettings } from '../../hooks/settingsHooks.ts';

export default function PlexSettingsPage() {
  const { servers, streamSettings, isPending, error } = usePlexSettings();

  if (isPending) {
    return <h1>XML: Loading...</h1>;
  } else if (error) {
    return <h1>XML: {error.message}</h1>;
  }

  console.log(servers, streamSettings);

  return <FormControl fullWidth></FormControl>;
}
