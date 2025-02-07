import { createFileRoute } from '@tanstack/react-router';
import { SystemDebugPage } from '../../pages/system/SystemDebugPage.tsx';

export const Route = createFileRoute('/system/debug')({
  component: SystemDebugPage,
});
