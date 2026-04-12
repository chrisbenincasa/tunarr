import {
  getMediaSourcesOptions,
  getGlobalMediaSourceSettingsOptions,
} from '@/generated/@tanstack/react-query.gen.ts';
import { ScannerSettingsPage } from '@/pages/settings/ScannerSettingsPage.tsx';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/settings/scanner')({
  loader: ({ context }) => {
    return Promise.all([
      context.queryClient.ensureQueryData(getMediaSourcesOptions()),
      context.queryClient.ensureQueryData(getGlobalMediaSourceSettingsOptions()),
    ]);
  },
  component: ScannerSettingsPage,
});
