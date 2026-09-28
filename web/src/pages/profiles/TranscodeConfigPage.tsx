import { Trans } from '@lingui/react/macro';
import { Check, VisibilityOff } from '@mui/icons-material';
import { Paper, Stack, ToggleButton, Typography } from '@mui/material';
import { useNavigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import Breadcrumbs from '../../components/Breadcrumbs.tsx';
import { defaultNewTranscodeConfig } from '../../components/settings/ffmpeg/defaultNewTranscodeConfig.ts';
import { TranscodeConfigSettingsForm } from '../../components/settings/ffmpeg/TranscodeConfigSettingsForm.tsx';
import { useTranscodeConfig } from '../../hooks/settingsHooks.ts';
import useStore from '../../store/index.ts';
import { setShowAdvancedSettings } from '../../store/settings/actions.ts';

const TranscodeConfigPageLayout = ({
  title,
  children,
}: {
  title: ReactNode;
  children: ReactNode;
}) => {
  const showAdvancedSettings = useStore(
    (s) => s.settings.ui.showAdvancedSettings,
  );

  return (
    <Stack>
      <Breadcrumbs />
      <Stack direction={'row'}>
        <Typography variant="h3" flex={1}>
          {title}
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
      <Paper sx={{ p: [1, 2], mt: 2 }}>{children}</Paper>
    </Stack>
  );
};

type Props = {
  configId: string;
};

export default function TranscodeConfigPage({ configId }: Props) {
  const transcodeConfig = useTranscodeConfig(configId);

  return (
    <TranscodeConfigPageLayout title={transcodeConfig.data.name}>
      <TranscodeConfigSettingsForm initialConfig={transcodeConfig.data} />
    </TranscodeConfigPageLayout>
  );
}

export function NewTranscodeConfigPage() {
  const navigate = useNavigate();

  return (
    <TranscodeConfigPageLayout title={<Trans>New Transcode Config</Trans>}>
      <TranscodeConfigSettingsForm
        initialConfig={defaultNewTranscodeConfig}
        isNew
        onCreated={(config) =>
          navigate({
            to: '/profiles/transcode/$configId',
            params: { configId: config.id },
            replace: true,
          })
        }
      />
    </TranscodeConfigPageLayout>
  );
}
