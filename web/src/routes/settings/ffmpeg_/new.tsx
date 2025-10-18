import { NewTranscodeConfigSettingsPage } from '@/pages/settings/NewTranscodeConfigSettingsPage';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/settings/ffmpeg_/new')({
  component: NewTranscodeConfigSettingsPage,
});
