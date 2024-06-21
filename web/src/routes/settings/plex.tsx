import { plexStreamSettingsQueryWithApi } from '@/hooks/settingsHooks';
import PlexSettingsPage from '@/pages/settings/PlexSettingsPage';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/settings/plex')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      plexStreamSettingsQueryWithApi(context.tunarrApiClientProvider()),
    ),
  component: PlexSettingsPage,
});
