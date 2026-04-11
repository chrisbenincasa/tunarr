import {
  getApiMediaSourcesOptions,
  getApiSettingsMediaSourceOptions,
} from '@/generated/@tanstack/react-query.gen.ts';
import { ScannerSettingsPage } from '@/pages/settings/ScannerSettingsPage.tsx';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/settings/scanner')({
  loader: ({ context }) => {
    return Promise.all([
      context.queryClient.ensureQueryData(getApiMediaSourcesOptions()),
      context.queryClient.ensureQueryData(getApiSettingsMediaSourceOptions()),
    ]);
  },
  component: ScannerSettingsPage,
});
