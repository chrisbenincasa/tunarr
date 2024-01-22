import { DataTag, useQuery } from '@tanstack/react-query';
import { apiClient } from '../external/api.ts';

export const useCustomShowsQuery = {
  queryKey: ['custom-shows'] as DataTag<
    ['custom-shows'],
    Awaited<ReturnType<(typeof apiClient)['getCustomShows']>>
  >,
  queryFn: () => apiClient.getCustomShows(),
};

export const useCustomShows = () => useQuery(useCustomShowsQuery);
