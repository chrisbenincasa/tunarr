import { Trans } from '@lingui/react/macro';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/channels/test')({
<<<<<<< HEAD
  component: () => <div><Trans>Test</Trans></div>,
=======
  component: () => <div>Test</div>,
>>>>>>> 4ca4b75d (feat: add slot linking support to infinite schedules)
});
