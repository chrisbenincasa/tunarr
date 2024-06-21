import { ApiClient } from '@/external/api';
import { QueryClient } from '@tanstack/react-query';

export interface RouterContext {
  queryClient: QueryClient;
  tunarrApiClientProvider: () => ApiClient;
}
