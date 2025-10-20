import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/channels_/test')({
  component: () => <div>Test</div>,
});
