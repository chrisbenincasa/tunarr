import GeneralSettingsPage from '@/pages/settings/GeneralSettingsPage';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/settings/general')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({
      queryFn() {
        return context.tunarrApiClientProvider().getSystemState();
      },
      queryKey: ['system', 'state'],
    });
  },
  component: GeneralSettingsPage,
});
