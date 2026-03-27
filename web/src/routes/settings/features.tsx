import FeaturesSettingsPage from '@/pages/settings/FeaturesSettingsPage';
import { createFileRoute } from '@tanstack/react-router';
import { getApiSystemFeatureFlagsOptions } from '../../generated/@tanstack/react-query.gen.ts';

export const Route = createFileRoute('/settings/features')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      getApiSystemFeatureFlagsOptions(),
    );
  },
  component: FeaturesSettingsPage,
});
