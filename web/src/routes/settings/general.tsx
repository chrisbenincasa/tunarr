import GeneralSettingsPage from '@/pages/settings/GeneralSettingsPage';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/settings/general')({
  component: GeneralSettingsPage,
});
