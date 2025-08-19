import GeneralSettingsPage from '@/pages/settings/GeneralSettingsPage';
import { createFileRoute } from '@tanstack/react-router';
import { getApiSystemStateOptions } from '../../generated/@tanstack/react-query.gen.ts';

export const Route = createFileRoute('/settings/general')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({
      ...getApiSystemStateOptions(),
    });
  },
  component: GeneralSettingsPage,
});
