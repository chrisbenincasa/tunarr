import { QueryCache, QueryClient } from '@tanstack/react-query';

interface TunarrQueryMeta extends Record<string, unknown> {
  /**
   * Set on queries that render their own error state, so a failure doesn't
   * also raise the global "failed to load" snackbar.
   */
  suppressErrorSnackbar?: boolean;
}

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: TunarrQueryMeta;
  }
}

// Shared query cache so non-hook / in-component usages share the same
// underlying cache
export const queryCache = new QueryCache({
  onError: (err) => {
    if (import.meta.env.DEV) {
      console.error('Query error', err);
    }
  },
});

export const queryClient = new QueryClient({ queryCache });
