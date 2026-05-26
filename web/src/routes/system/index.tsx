import { createFileRoute } from '@tanstack/react-router';
import {
  getMigrationStateOptions,
  getSystemSettingsOptions,
} from '../../generated/@tanstack/react-query.gen.ts';
import { StatusPage } from '../../pages/system/StatusPage.tsx';

export const Route = createFileRoute('/system/')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({
      ...getSystemSettingsOptions(),
    });

    await context.queryClient.ensureQueryData({
      ...getMigrationStateOptions(),
    });
  },
  component: StatusPage,
});
