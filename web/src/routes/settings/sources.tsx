import MediaSourceSettingsPage from '@/pages/settings/MediaSourceSettingsPage';
import { createFileRoute } from '@tanstack/react-router';
import { getApiPlexSettingsOptions } from '../../generated/@tanstack/react-query.gen.ts';

export const Route = createFileRoute('/settings/sources')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(getApiPlexSettingsOptions()),
  component: MediaSourceSettingsPage,
});
