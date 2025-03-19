import { TranscodeConfigSettingsForm } from '@/components/settings/ffmpeg/TranscodeConfigSettingsForm';

import { useTunarrApi } from '@/hooks/useTunarrApi';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TranscodeConfig } from '@tunarr/types';

const defaultNewTranscodeConfig: TranscodeConfig = {
  id: '',
  name: 'New Config',
  threadCount: 0,
  resolution: {
    widthPx: 1920,
    heightPx: 1080,
  },
  audioBitRate: 192,
  audioBufferSize: 192 * 3,
  audioChannels: 2,
  audioSampleRate: 48,
  audioFormat: 'aac',
  hardwareAccelerationMode: 'none',
  normalizeFrameRate: false,
  deinterlaceVideo: true,
  videoBitRate: 3500,
  videoBufferSize: 3500 * 2,
  videoFormat: 'h264',
  isDefault: false,
  audioVolumePercent: 100,
  disableChannelOverlay: false,
  errorScreen: 'pic',
  errorScreenAudio: 'silent',
  vaapiDevice: '',
  vaapiDriver: 'system',
  videoBitDepth: 8,
  videoPreset: '',
  videoProfile: '',
};

export const NewTranscodeConfigSettingsPage = () => {
  const apiClient = useTunarrApi();
  const queryClient = useQueryClient();

  const updateConfigMutation = useMutation({
    mutationFn: (data: TranscodeConfig) =>
      apiClient.createTranscodeConfig(data),
    onSuccess: () => {
      return queryClient.invalidateQueries({
        queryKey: ['settings', 'transcode_configs'],
        exact: false,
      });
    },
  });

  return (
    <TranscodeConfigSettingsForm
      initialConfig={defaultNewTranscodeConfig}
      onSave={(conf) => updateConfigMutation.mutateAsync(conf)}
      isNew
    />
  );
};
