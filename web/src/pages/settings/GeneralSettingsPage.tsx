import { GeneralSettingsForm } from '@/components/settings/general/GeneralSettingsForm.tsx';
import { WebSettings } from '@/components/settings/general/WebSettings.tsx';
import { Box, Divider } from '@mui/material';
import Stack from '@mui/material/Stack';
import {
  CacheSettings,
  LogLevel,
  LogLevels,
  SystemSettings,
} from '@tunarr/types';
import { BackupSettings } from '@tunarr/types/schemas';
import { map } from 'lodash-es';
import { useSystemSettings } from '../../hooks/useSystemSettings.ts';

export type GeneralSettingsFormData = {
  backendUri: string;
  logLevel: LogLevel | 'env';
  backup: BackupSettings;
  cache: CacheSettings;
};

export type GeneralSetingsFormProps = {
  systemSettings: SystemSettings;
};

export const LogLevelChoices = [
  {
    description: 'Use environment settings',
    value: 'env',
  },
  ...map(LogLevels, (level) => ({
    description: level,
    value: level,
  })),
];

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
