import MediaSourceSettingsPage from '@/pages/settings/MediaSourceSettingsPage';
import { createFileRoute } from '@tanstack/react-router';
import {
  getMediaSourcesOptions,
  getGlobalMediaSourceSettingsOptions,
} from '../../generated/@tanstack/react-query.gen.ts';

export const Route = createFileRoute('/settings/sources')({
  loader: ({ context }) => {
    return Promise.all([
      context.queryClient.ensureQueryData(getMediaSourcesOptions()),
      context.queryClient.ensureQueryData(getGlobalMediaSourceSettingsOptions()),
    ]);
  },
  component: MediaSourceSettingsPage,
});
