import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/channels/test')({
  component: () => <div>Test</div>,
});
