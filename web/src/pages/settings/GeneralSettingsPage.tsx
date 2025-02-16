import { GeneralSettingsForm } from '@/components/settings/general/GeneralSettingsForm.tsx';
import { WebSettings } from '@/components/settings/general/WebSettings.tsx';
import { Box, Divider } from '@mui/material';
import Stack from '@mui/material/Stack';
import { useSystemSettings } from '../../hooks/useSystemSettings.ts';

export default function GeneralSettingsPage() {
  const systemSettings = useSystemSettings();

  // TODO: Handle loading and error states.

  return (
    systemSettings.data && (
      <Box>
        <Stack direction="column" gap={2}>
          <WebSettings />
          <Divider />
          <GeneralSettingsForm systemSettings={systemSettings.data} />
        </Stack>
      </Box>
    )
  );
}
