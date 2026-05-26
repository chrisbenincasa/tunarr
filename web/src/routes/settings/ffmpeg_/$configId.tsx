import { EditTranscodeConfigSettingsPage } from '@/pages/settings/EditTranscodeConfigSettingsPage';
import { createFileRoute } from '@tanstack/react-router';
import { getTranscodeConfigByIdOptions } from '../../../generated/@tanstack/react-query.gen.ts';

export const Route = createFileRoute('/settings/ffmpeg_/$configId')({
  loader: ({ params, context }) => {
    return context.queryClient.ensureQueryData(
      getTranscodeConfigByIdOptions({
        path: { id: params.configId },
      }),
    );
  },
  component: EditTranscodeConfigSettingsPage,
});
