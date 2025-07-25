import { TranscodeConfigSettingsForm } from '@/components/settings/ffmpeg/TranscodeConfigSettingsForm';

import { useTranscodeConfig } from '@/hooks/settingsHooks';
import { useTunarrApi } from '@/hooks/useTunarrApi';
import { Route } from '@/routes/settings/ffmpeg_/$configId';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { TranscodeConfig } from '@tunarr/types';

export const EditTranscodeConfigSettingsPage = () => {
  const { configId } = Route.useParams();

  const transcodeConfig = useTranscodeConfig(configId);

  const apiClient = useTunarrApi();
  const queryClient = useQueryClient();

  const updateConfigMutation = useMutation({
    mutationFn: (data: TranscodeConfig) =>
      apiClient.updateTranscodeConfig(data, { params: { id: configId } }),
    onSuccess: () => {
      return queryClient.invalidateQueries({
        queryKey: ['settings', 'transcode_configs'],
        exact: false,
      });
    },
  });

  return (
    <TranscodeConfigSettingsForm
      initialConfig={transcodeConfig.data}
      onSave={(conf) => updateConfigMutation.mutateAsync(conf)}
    />
  );
};
