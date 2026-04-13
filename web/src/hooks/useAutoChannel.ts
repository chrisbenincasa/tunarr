import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AutoChannelCreateRequest,
  ChannelPreset,
  ContentPreviewResponse,
  ContentQuery,
} from '@tunarr/types/api';
import type { Channel } from '@tunarr/types';
import useStore from '../store/index.ts';

function getBackendUrl(path: string): string {
  const backendUri = useStore.getState().settings.backendUri;
  return `${backendUri}/api${path}`;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Request failed (${response.status}): ${body}`);
  }
  return response.json() as Promise<T>;
}

export function useAutoChannelPresets() {
  return useQuery({
    queryKey: ['auto-channel', 'presets'],
    queryFn: () =>
      fetchJson<ChannelPreset[]>(getBackendUrl('/auto-channels/presets')),
  });
}

export function usePreviewContent() {
  return useMutation({
    mutationFn: (query: ContentQuery) =>
      fetchJson<ContentPreviewResponse>(
        getBackendUrl('/auto-channels/preview-content'),
        {
          method: 'POST',
          body: JSON.stringify(query),
        },
      ),
  });
}

export function useAutoCreateChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: AutoChannelCreateRequest) =>
      fetchJson<Channel>(getBackendUrl('/auto-channels/create'), {
        method: 'POST',
        body: JSON.stringify(request),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        exact: false,
        queryKey: ['Channels'],
      });
    },
  });
}
