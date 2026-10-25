import { createFileRoute } from '@tanstack/react-router';
import { NewTranscodeConfigPage } from '../../../pages/profiles/TranscodeConfigPage.tsx';

export const Route = createFileRoute('/profiles/transcode_/new')({
  component: NewTranscodeConfigPage,
});
