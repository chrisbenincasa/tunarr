import Link from '@mui/material/Link';

import {
  AnyRoute,
  RegisteredRouter,
  Link as RouterLink,
} from '@tanstack/react-router';
import { LinkRouterProps } from '../types/router';

export default function LinkRouter<
  TRouteTree extends AnyRoute = RegisteredRouter['routeTree'],
  TTo extends string = '',
>(props: LinkRouterProps<TRouteTree, TTo>) {
  return <Link {...props} component={RouterLink as any} />;
}
