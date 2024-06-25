import { Root } from '@/App';
import { RouterContext } from '@/types/RouterContext';
import { Link, createRootRouteWithContext } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@/dev/TanStackRouterDevtools';

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
      <Link to="/">Go home</Link>
    </div>
  ),
});
