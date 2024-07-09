import { plexStreamSettingsQueryWithApi } from '@/hooks/settingsHooks';
import MediaSourceSettingsPage from '@/pages/settings/MediaSourceSettingsPage';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/settings/sources')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      plexStreamSettingsQueryWithApi(context.tunarrApiClientProvider()),
    ),
  component: MediaSourceSettingsPage,
});
