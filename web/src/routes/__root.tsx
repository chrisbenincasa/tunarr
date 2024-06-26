import { Root } from '@/App';
import { RouterContext } from '@/types/RouterContext';
import {
  Link as RouterLink,
  createRootRouteWithContext,
} from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@/dev/TanStackRouterDevtools';
import { ErrorPage } from '@/pages/ErrorPage';
import { Link } from '@mui/material';

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
      </Root>
    );
  },
});
