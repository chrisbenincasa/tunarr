import Link, { LinkProps, LinkTypeMap } from '@mui/material/Link';
import {
  AnyRoute,
  RegisteredRouter,
  Link as RouterLink,
} from '@tanstack/react-router';
import { LinkRouterProps } from '../types/router';

export default function LinkRouter<
  TRouteTree extends AnyRoute = RegisteredRouter['routeTree'],
  TTo extends string = '',
  RootComponent extends React.ElementType = LinkTypeMap['defaultComponent'],
>(props: LinkProps<RootComponent, LinkRouterProps<TRouteTree, TTo>>) {
  return <Link {...props} component={RouterLink} />;
}
