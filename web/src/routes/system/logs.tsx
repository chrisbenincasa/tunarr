import { createFileRoute } from '@tanstack/react-router';
import { SystemLogsPage } from '../../pages/system/SystemLogsPage.tsx';

export const Route = createFileRoute('/system/logs')({
  component: SystemLogsPage,
});
