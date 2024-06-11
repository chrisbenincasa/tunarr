import { QueryCache, QueryClient } from '@tanstack/react-query';

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
