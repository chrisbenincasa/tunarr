import { TranscodeConfigSettingsForm } from '@/components/settings/ffmpeg/TranscodeConfigSettingsForm';

import { useTranscodeConfig } from '@/hooks/settingsHooks';
import { Route } from '@/routes/settings/ffmpeg_/$configId';

export const EditTranscodeConfigSettingsPage = () => {
  const { configId } = Route.useParams();

  const transcodeConfig = useTranscodeConfig(configId);

  return <TranscodeConfigSettingsForm initialConfig={transcodeConfig.data} />;
};
