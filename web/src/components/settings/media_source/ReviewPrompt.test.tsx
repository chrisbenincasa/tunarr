import type { MediaSourceSettings } from '@tunarr/types';
import { QueryClient } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { describe, expect, test } from 'vitest';
import {
  getApiMediaSourcesByIdLibrariesQueryKey,
  getApiMediaSourcesQueryKey,
} from '../../../generated/@tanstack/react-query.gen.ts';
import { renderWithProviders, screen, waitFor } from '../../../test/utils.tsx';
import { NewMediaSourceLibrariesPrompt } from './NewMediaSourceLibrariesPrompt.tsx';

const lib = (
  id: string,
  type: 'plex' | 'local',
  enabled: boolean,
): MediaSourceSettings['libraries'][number] => ({
  id,
  name: `${type}-lib-${id}`,
  mediaType: 'movies',
  externalKey: id,
  type,
  enabled,
  isLocked: false,
});

const source = (
  id: string,
  type: 'plex' | 'local',
  libs: MediaSourceSettings['libraries'],
): MediaSourceSettings =>
  type === 'local'
    ? {
        id,
        name: `local-${id}`,
        type: 'local',
        mediaType: 'movies',
        paths: [],
        libraries: libs,
        pathReplacements: [],
      }
    : {
        id,
        name: `plex-${id}`,
        type: 'plex',
        uri: 'http://plex',
        accessToken: 'x',
        userId: null,
        username: null,
        sendPlayStatusUpdates: false,
        sendGuideUpdates: false,
        index: 0,
        libraries: libs,
        pathReplacements: [],
      };

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
}

function seed(qc: QueryClient, sources: MediaSourceSettings[]) {
  qc.setQueryData(getApiMediaSourcesQueryKey(), sources);
  for (const s of sources) {
    qc.setQueryData(
      getApiMediaSourcesByIdLibrariesQueryKey({ path: { id: s.id } }),
      s.libraries.map((l) => ({ ...l, mediaSource: s })),
    );
  }
}

describe('NewMediaSourceLibrariesPrompt', () => {
  test('baseline load never prompts', async () => {
    const qc = makeClient();
    seed(qc, [source('a', 'plex', [lib('l1', 'plex', true)])]);
    renderWithProviders(
      <StrictMode>
        <NewMediaSourceLibrariesPrompt />
      </StrictMode>,
      { queryClient: qc },
    );
    await waitFor(() =>
      expect(qc.getQueryData(getApiMediaSourcesQueryKey())).toBeTruthy(),
    );
    expect(screen.queryByText('Manage Libraries')).not.toBeInTheDocument();
  });

  test('new remote source with no enabled library opens the picker', async () => {
    const qc = makeClient();
    seed(qc, [source('a', 'plex', [lib('l1', 'plex', true)])]);
    renderWithProviders(
      <StrictMode>
        <NewMediaSourceLibrariesPrompt />
      </StrictMode>,
      { queryClient: qc },
    );
    expect(screen.queryByText('Manage Libraries')).not.toBeInTheDocument();

    const next = [
      source('a', 'plex', [lib('l1', 'plex', true)]),
      source('b', 'plex', [lib('l2', 'plex', false)]),
    ];
    seed(qc, next);

    await waitFor(() =>
      expect(screen.getByText('Manage Libraries')).toBeInTheDocument(),
    );
  });

  test('picker stays closed after the user dismisses it', async () => {
    const qc = makeClient();
    seed(qc, [source('a', 'plex', [lib('l1', 'plex', true)])]);
    const { user } = renderWithProviders(
      <StrictMode>
        <NewMediaSourceLibrariesPrompt />
      </StrictMode>,
      { queryClient: qc },
    );

    seed(qc, [
      source('a', 'plex', [lib('l1', 'plex', true)]),
      source('b', 'plex', [lib('l2', 'plex', false)]),
    ]);
    await waitFor(() =>
      expect(screen.getByText('Manage Libraries')).toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() =>
      expect(screen.queryByText('Manage Libraries')).not.toBeInTheDocument(),
    );
    // Give any erroneous re-open a chance to happen.
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.queryByText('Manage Libraries')).not.toBeInTheDocument();
  });

  test('new source with an enabled library does not prompt', async () => {
    const qc = makeClient();
    seed(qc, [source('a', 'plex', [lib('l1', 'plex', true)])]);
    renderWithProviders(
      <StrictMode>
        <NewMediaSourceLibrariesPrompt />
      </StrictMode>,
      { queryClient: qc },
    );

    seed(qc, [
      source('a', 'plex', [lib('l1', 'plex', true)]),
      source('b', 'plex', [lib('l2', 'plex', true)]),
    ]);
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.queryByText('Manage Libraries')).not.toBeInTheDocument();
  });

  test('new local source does not prompt', async () => {
    const qc = makeClient();
    seed(qc, [source('a', 'plex', [lib('l1', 'plex', true)])]);
    renderWithProviders(
      <StrictMode>
        <NewMediaSourceLibrariesPrompt />
      </StrictMode>,
      { queryClient: qc },
    );

    seed(qc, [
      source('a', 'plex', [lib('l1', 'plex', true)]),
      source('c', 'local', [lib('l3', 'local', false)]),
    ]);
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.queryByText('Manage Libraries')).not.toBeInTheDocument();
  });
});
