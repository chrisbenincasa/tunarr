import { createFileRoute, Outlet } from '@tanstack/react-router';
import { setCurrentEntityType } from '../../../store/channelEditor/actions.ts';

export const Route = createFileRoute('/channels/$channelId')({
  loader() {
    setCurrentEntityType('channel');
  },
  component: Outlet,
});
