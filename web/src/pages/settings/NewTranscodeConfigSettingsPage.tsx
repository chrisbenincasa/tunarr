import { TranscodeConfigSettingsForm } from '@/components/settings/ffmpeg/TranscodeConfigSettingsForm';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { TranscodeConfig } from '@tunarr/types';
import {
  getApiTranscodeConfigsQueryKey,
  postApiTranscodeConfigsMutation,
} from '../../generated/@tanstack/react-query.gen.ts';

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
  disableHardwareDecoder: false,
  disableHardwareEncoding: false,
  disableHardwareFilters: false,
};

export const NewTranscodeConfigSettingsPage = () => {
  const queryClient = useQueryClient();

  const updateConfigMutation = useMutation({
    ...postApiTranscodeConfigsMutation(),
    onSuccess: () => {
      return queryClient.invalidateQueries({
        queryKey: getApiTranscodeConfigsQueryKey(),
        exact: false,
      });
    },
  });

  return (
    <TranscodeConfigSettingsForm
      initialConfig={defaultNewTranscodeConfig}
      onSave={(conf) => updateConfigMutation.mutateAsync({ body: conf })}
      isNew
    />
  );
};
