import type { ApiClient } from '@/external/api';
import type { QueryClient } from '@tanstack/react-query';

export interface RouterContext {
  queryClient: QueryClient;
  tunarrApiClientProvider: () => ApiClient;
}
