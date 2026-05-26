import GeneralSettingsPage from '@/pages/settings/GeneralSettingsPage';
import { createFileRoute } from '@tanstack/react-router';
import { getSystemStateOptions } from '../../generated/@tanstack/react-query.gen.ts';

export const Route = createFileRoute('/settings/general')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({
      ...getSystemStateOptions(),
    });
  },
  component: GeneralSettingsPage,
});
