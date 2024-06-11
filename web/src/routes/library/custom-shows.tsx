import CustomShowsPage from '@/pages/library/CustomShowsPage';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/library/custom-shows')({
  component: CustomShowsPage,
});
