import { RootRoute, Route, Router } from '@tanstack/react-router';
import App, { Root } from './App.tsx';
import ChannelsPage from './pages/channels/ChannelsPage.tsx';
import WatchPage from './pages/watch/WatchPage.tsx';

const rootRoute = new RootRoute({
  component: Root,
});

const indexRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/',
  component: App,
});

const channelsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/channels',
  component: ChannelsPage,
});

const watchRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/watch',
  component: WatchPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  channelsRoute,
  watchRoute,
]);

export const router = new Router({ routeTree });
