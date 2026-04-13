import { AutoCreateWizard } from '@/pages/channels/AutoCreateWizard';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/channels_/auto-create')({
  component: () => <AutoCreateWizard />,
});
