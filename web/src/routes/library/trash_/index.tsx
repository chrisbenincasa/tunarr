import { createFileRoute } from '@tanstack/react-router';
import { TrashPage } from '../../../pages/library/TrashPage.tsx';

export const Route = createFileRoute('/library/trash_/')({
  component: TrashPage,
});
