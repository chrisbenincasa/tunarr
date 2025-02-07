import { createFileRoute } from '@tanstack/react-router';
import { StatusPage } from '../../pages/system/StatusPage.tsx';

export const Route = createFileRoute('/system/')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({
      queryFn() {
        return context.tunarrApiClientProvider().getSystemSettings();
      },
      queryKey: ['system', 'settings'],
    });

    await context.queryClient.ensureQueryData({
      queryFn() {
        return context.tunarrApiClientProvider().getSystemState();
      },
      queryKey: ['system', 'state'],
    });

    // setShowWelcome(systemState.isFreshSettings);
    // if (systemState.isFreshSettings) {
    //   throw redirect({
    //     to: '/welcome',
    //   });
    // }
  },
  component: StatusPage,
});
