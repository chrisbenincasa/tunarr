import { StatusPage } from '@/pages/system/StatusPage';
import { setShowWelcome } from '@/store/themeEditor/actions';
import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({
      queryFn() {
        return context.tunarrApiClientProvider().getSystemSettings();
      },
      queryKey: ['system', 'settings'],
    });

    const systemState = await context.queryClient.ensureQueryData({
      queryFn() {
        return context.tunarrApiClientProvider().getSystemMigrationState();
      },
      queryKey: ['system', 'migration-state'],
    });

    setShowWelcome(systemState.isFreshSettings);
    if (systemState.isFreshSettings) {
      throw redirect({
        to: '/welcome',
      });
    }
  },
  component: StatusPage,
});
