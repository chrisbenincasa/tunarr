import { EditTranscodeConfigSettingsPage } from '@/pages/settings/EditTranscodeConfigSettingsPage';
import { createFileRoute } from '@tanstack/react-router';
import { getApiTranscodeConfigsByIdOptions } from '../../../generated/@tanstack/react-query.gen.ts';

export const Route = createFileRoute('/settings/ffmpeg_/$configId')({
  loader: ({ params, context }) => {
    return context.queryClient.ensureQueryData(
      getApiTranscodeConfigsByIdOptions({
        path: { id: params.configId },
      }),
    );
  },
  component: EditTranscodeConfigSettingsPage,
});
