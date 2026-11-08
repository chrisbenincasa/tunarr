import type { QueryCacheNotifyEvent } from '@tanstack/react-query';
import { isCancelledError } from '@tanstack/react-query';

/**
 * Decides whether a query cache event should raise the global "failed to
 * load" snackbar. It fires only when a query fails and the user would
 * otherwise see an empty view with no explanation.
 *
 * Skipped cases:
 * - Canceled fetches.
 * - Queries no component is watching. Route loaders and suspense queries land
 *   here and already render the route error page.
 * - Queries that have loaded at least once. A failed refetch leaves the old
 *   data on screen, and `initialData` placeholders don't count as a load.
 * - Queries that opt out with `meta.suppressErrorSnackbar` because they render
 *   their own error state.
 */
export function shouldNotifyQueryError(event: QueryCacheNotifyEvent): boolean {
  if (event.type !== 'updated' || event.action.type !== 'error') {
    return false;
  }

  if (isCancelledError(event.action.error)) {
    return false;
  }

  const { query } = event;

  return (
    query.getObserversCount() > 0 &&
    query.state.dataUpdateCount === 0 &&
    !query.meta?.suppressErrorSnackbar
  );
}
