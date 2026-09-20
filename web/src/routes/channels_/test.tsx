import { Trans } from '@lingui/react/macro';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/channels_/test')({
  component: () => (
    <div>
      <Trans>Test</Trans>
    </div>
  ),
});
