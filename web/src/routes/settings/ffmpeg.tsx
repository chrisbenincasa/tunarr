import FfmpegSettingsPage from '@/pages/settings/FfmpegSettingsPage';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/settings/ffmpeg')({
  component: FfmpegSettingsPage,
});
