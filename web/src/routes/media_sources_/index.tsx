import { createFileRoute } from '@tanstack/react-router';
import MediaSourceSettingsPage from '../../pages/settings/MediaSourceSettingsPage.tsx';

export const Route = createFileRoute('/media_sources/')({
  component: MediaSourceSettingsPage,
});
