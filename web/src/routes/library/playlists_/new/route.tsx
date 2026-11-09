import { createFileRoute } from '@tanstack/react-router';
import { setCurrentEntityType } from '../../../../store/channelEditor/actions.ts';

export const Route = createFileRoute('/library/playlists_/new')({
  loader() {
    setCurrentEntityType('custom-show');
  },
});
