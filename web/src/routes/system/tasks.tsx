import { createFileRoute } from '@tanstack/react-router';
import TaskSettingsPage from '../../pages/settings/TaskSettingsPage.tsx';

export const Route = createFileRoute('/system/tasks')({
  component: TaskSettingsPage,
});
