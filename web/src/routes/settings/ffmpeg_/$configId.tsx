import { transcodeConfigQueryOptions } from '@/hooks/settingsHooks';
import { EditTranscodeConfigSettingsPage } from '@/pages/settings/EditTranscodeConfigSettingsPage';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/settings/ffmpeg/$configId')({
  loader: ({ params, context }) => {
    return context.queryClient.ensureQueryData(
      transcodeConfigQueryOptions(
        context.tunarrApiClientProvider(),
        params.configId,
      ),
    );
  },
  component: EditTranscodeConfigSettingsPage,
});
