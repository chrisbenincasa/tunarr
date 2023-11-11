import { LinkProps } from '@mui/material/Link';

import {
  AnyRoute,
  MakeLinkOptions,
  RegisteredRouter,
} from '@tanstack/react-router';

import { router } from '../router.ts';

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export type LinkRouterProps<
  TRouteTree extends AnyRoute = RegisteredRouter['routeTree'],
  TTo extends string = '',
> = MakeLinkOptions<TRouteTree, '/', TTo> & LinkProps;
