import { createFileRoute } from '@tanstack/react-router';
import { setCurrentEntityType } from '../../../../store/channelEditor/actions.ts';

export const Route = createFileRoute('/library/custom-shows_/$showId')({
  loader() {
    setCurrentEntityType('custom-show');
  },
});
