import { Root } from '@/App';
import { TanStackRouterDevtools } from '@/dev/TanStackRouterDevtools';
import { ErrorPage } from '@/pages/ErrorPage';
import type { RouterContext } from '@/types/RouterContext';
import { Link } from '@mui/material';
import {
  Link as RouterLink,
  createRootRouteWithContext,
} from '@tanstack/react-router';

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <>
      <Root />
      <TanStackRouterDevtools />
    </>
  ),
  notFoundComponent: () => (
    <div>
      <p>Not found!</p>
      <Link component={RouterLink} to="/">
        Go Home
      </Link>
    </div>
  ),
  errorComponent: ({ error, reset }) => {
    return (
      <Root>
        <ErrorPage error={error} resetRoute={reset} />
        <TanStackRouterDevtools />
      </Root>
    );
  },
});
