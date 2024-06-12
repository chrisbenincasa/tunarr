import WelcomePage from '@/pages/welcome/WelcomePage';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/welcome')({
  component: WelcomePage,
});
