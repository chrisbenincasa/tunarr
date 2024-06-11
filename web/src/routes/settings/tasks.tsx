import TaskSettingsPage from '@/pages/settings/TaskSettingsPage';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/settings/tasks')({
  component: TaskSettingsPage,
});
