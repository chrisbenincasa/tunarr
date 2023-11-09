import { RootRoute, Route, Router } from '@tanstack/react-router';
import App, { Root } from './App.tsx';
import ChannelsPage from './pages/channels/ChannelsPage.tsx';

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

const routeTree = rootRoute.addChildren([indexRoute, channelsRoute]);

export const router = new Router({ routeTree });
