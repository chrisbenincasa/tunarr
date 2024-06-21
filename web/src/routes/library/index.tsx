import LibraryIndexPage from '@/pages/library/LibraryIndexPage';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/library/')({
  component: LibraryIndexPage,
});
