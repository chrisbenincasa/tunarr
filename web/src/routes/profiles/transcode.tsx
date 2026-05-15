import { createFileRoute } from '@tanstack/react-router';
import TranscodeConfigsPage from '../../pages/profiles/TranscodeConfigsPage.tsx';

export const Route = createFileRoute('/profiles/transcode')({
  component: TranscodeConfigsPage,
});
