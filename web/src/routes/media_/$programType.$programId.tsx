import { ProgramPage } from '@/pages/media/ProgramPage';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/media_/$programType/$programId')({
  component: ProgramPage,
});
