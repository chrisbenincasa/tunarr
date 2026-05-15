import { Trans } from '@lingui/react/macro';
import { Check, VisibilityOff } from '@mui/icons-material';
import { Paper, Stack, ToggleButton, Typography } from '@mui/material';
import Breadcrumbs from '../../components/Breadcrumbs.tsx';
import { TranscodeConfigSettingsForm } from '../../components/settings/ffmpeg/TranscodeConfigSettingsForm.tsx';
import { useTranscodeConfig } from '../../hooks/settingsHooks.ts';
import useStore from '../../store/index.ts';
import { setShowAdvancedSettings } from '../../store/settings/actions.ts';

type Props = {
  configId: string;
};

export default function TranscodeConfigPage({ configId }: Props) {
  const transcodeConfig = useTranscodeConfig(configId);
  const showAdvancedSettings = useStore(
    (s) => s.settings.ui.showAdvancedSettings,
  );

  return (
    <Stack>
      <Breadcrumbs />
      <Stack direction={'row'}>
        <Typography variant="h3" flex={1}>
          {transcodeConfig.data.name}
        </Typography>
        <ToggleButton
          value={showAdvancedSettings}
          selected={showAdvancedSettings}
          onChange={() => setShowAdvancedSettings(!showAdvancedSettings)}
          sx={{ ml: 'auto' }}
        >
          {showAdvancedSettings ? (
            <VisibilityOff sx={{ mr: 0.5 }} />
          ) : (
            <Check sx={{ mr: 0.5 }} />
          )}{' '}
          {showAdvancedSettings ? (
            <Trans>Hide Advanced</Trans>
          ) : (
            <Trans>Show Advanced</Trans>
          )}
        </ToggleButton>
      </Stack>
      <Paper sx={{ p: [1, 2], mt: 2 }}>
        <TranscodeConfigSettingsForm initialConfig={transcodeConfig.data} />
      </Paper>
    </Stack>
  );
}
