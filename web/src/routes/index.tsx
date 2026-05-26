import { setShowWelcome } from '@/store/themeEditor/actions';
import { createFileRoute, redirect } from '@tanstack/react-router';
import {
  getMigrationStateOptions,
  getSystemSettingsOptions,
} from '../generated/@tanstack/react-query.gen.ts';
import GuidePage from '../pages/guide/GuidePage.tsx';

export const Route = createFileRoute('/')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({
      ...getSystemSettingsOptions(),
    });

    const systemState = await context.queryClient.ensureQueryData({
      ...getMigrationStateOptions(),
    });

    setShowWelcome(!!systemState.isFreshSettings);
    if (systemState.isFreshSettings) {
      throw redirect({
        to: '/welcome',
      });
    }
  },
  component: () => <GuidePage channelId="all" />,
});
