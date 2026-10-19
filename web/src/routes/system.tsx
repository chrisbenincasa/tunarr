import { createFileRoute } from '@tanstack/react-router';
import { SystemLayout } from '../pages/system/SystemLayout.tsx';

export const Route = createFileRoute('/system')({
  component: SystemLayout,
});
