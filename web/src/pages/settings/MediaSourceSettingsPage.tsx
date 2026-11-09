import { AddMediaSourceButton } from '@/components/settings/media_source/AddMediaSourceButton.tsx';
import { useMediaSources } from '@/hooks/settingsHooks.ts';
import {
  type UseQueryResult,
  useMutation,
  useQueries,
  useQueryClient,
} from '@tanstack/react-query';
import type { MediaSourceSettings } from '@tunarr/types';
import { useCallback, useState } from 'react';
import { EditMediaSourceLibrariesDialog } from '../../components/settings/media_source/EditMediaSourceLibrariesDialog.tsx';
import { EmbyServerEditDialog } from '../../components/settings/media_source/EmbyServerEditDialog.tsx';
import { JellyfinServerEditDialog } from '../../components/settings/media_source/JelllyfinServerEditDialog.tsx';
import { LocalMediaEditDialog } from '../../components/settings/media_source/LocalMediaEditDialog.tsx';
import type { MediaSourceHealth } from '../../components/settings/media_source/MediaSourceHealthPill.tsx';
import { MediaSourcesView } from '../../components/settings/media_source/MediaSourcesView.tsx';
import { PlexServerEditDialog } from '../../components/settings/media_source/PlexServerEditDialog.tsx';
import {
  deleteApiMediaSourcesByIdMutation,
  getApiMediaSourcesByIdStatusOptions,
  postApiMediaSourcesByIdLibrariesRefreshMutation,
} from '../../generated/@tanstack/react-query.gen.ts';
import { invalidateTaggedQueries } from '../../helpers/queryUtil.ts';
import type { Nullable } from '../../types/util.ts';

type StatusResult = UseQueryResult<{ healthy: boolean }>;

const toHealth = (result: StatusResult | undefined): MediaSourceHealth => {
  if (!result || result.isLoading) {
    return 'checking';
  }
  return !result.error && result.data?.healthy ? 'healthy' : 'unhealthy';
};

const useMediaSourcesHealth = (sources: MediaSourceSettings[]) => {
  // A stable combine keeps the map stable between renders, so the table
  // columns that read it are not rebuilt.
  const combine = useCallback(
    (results: StatusResult[]) =>
      Object.fromEntries(
        sources.map((source, i) => [source.id, toHealth(results[i])]),
      ),
    [sources],
  );

  return useQueries({
    queries: sources.map((source) => ({
      ...getApiMediaSourcesByIdStatusOptions({ path: { id: source.id } }),
      staleTime: 1000 * 60 * 5,
    })),
    combine,
  });
};

export default function MediaSourceSettingsPage() {
  const { data: servers } = useMediaSources();
  const health = useMediaSourcesHealth(servers);

  const [editingMediaSource, setEditingMediaSource] =
    useState<Nullable<MediaSourceSettings>>(null);
  const [editingMediaSourceLibraries, setEditingMediaSourceLibraries] =
    useState<Nullable<MediaSourceSettings>>(null);

  const queryClient = useQueryClient();

  const deleteMediaSourceMut = useMutation({
    ...deleteApiMediaSourcesByIdMutation(),
    onSuccess: () => {
      return queryClient.invalidateQueries({
        predicate: invalidateTaggedQueries('Media Source'),
      });
    },
  });

  const { mutate: refreshLibraries } = useMutation({
    ...postApiMediaSourcesByIdLibrariesRefreshMutation(),
    onSuccess: () => {
      return queryClient.invalidateQueries({
        predicate: invalidateTaggedQueries('Media Source'),
      });
    },
  });

  return (
    <>
      <MediaSourcesView
        mediaSources={servers}
        health={health}
        addButton={<AddMediaSourceButton />}
        onEditSource={setEditingMediaSource}
        onRefreshLibraries={(source) =>
          refreshLibraries({ path: { id: source.id } })
        }
        onEditLibraries={setEditingMediaSourceLibraries}
        onDeleteSource={(source) =>
          deleteMediaSourceMut.mutate({ path: { id: source.id } })
        }
      />
      {editingMediaSource?.type === 'plex' && (
        <PlexServerEditDialog
          open
          onClose={() => setEditingMediaSource(null)}
          server={editingMediaSource}
        />
      )}
      {editingMediaSource?.type === 'jellyfin' && (
        <JellyfinServerEditDialog
          open
          onClose={() => setEditingMediaSource(null)}
          server={editingMediaSource}
        />
      )}
      {editingMediaSource?.type === 'emby' && (
        <EmbyServerEditDialog
          open
          onClose={() => setEditingMediaSource(null)}
          server={editingMediaSource}
        />
      )}
      {editingMediaSource?.type === 'local' && (
        <LocalMediaEditDialog
          open
          onClose={() => setEditingMediaSource(null)}
          source={editingMediaSource}
        />
      )}
      <EditMediaSourceLibrariesDialog
        open={!!editingMediaSourceLibraries}
        mediaSource={editingMediaSourceLibraries}
        onClose={() => setEditingMediaSourceLibraries(null)}
      />
    </>
  );
}
