import { TranscodeConfigSettingsForm } from '@/components/settings/ffmpeg/TranscodeConfigSettingsForm';

import { useTranscodeConfig } from '@/hooks/settingsHooks';
import { Route } from '@/routes/settings/ffmpeg_/$configId';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getApiTranscodeConfigsQueryKey,
  putApiTranscodeConfigsByIdMutation,
} from '../../generated/@tanstack/react-query.gen.ts';

export const EditTranscodeConfigSettingsPage = () => {
  const { configId } = Route.useParams();

  const transcodeConfig = useTranscodeConfig(configId);

  const queryClient = useQueryClient();

  const updateConfigMutation = useMutation({
    ...putApiTranscodeConfigsByIdMutation(),
    onSuccess: () => {
      return queryClient.invalidateQueries({
        queryKey: getApiTranscodeConfigsQueryKey(),
        exact: false,
      });
    },
  });

  return (
    <TranscodeConfigSettingsForm
      initialConfig={transcodeConfig.data}
      onSave={(conf) =>
        updateConfigMutation.mutateAsync({ path: { id: configId }, body: conf })
      }
    />
  );
};
