import { enumerateJellyfinItem } from '@/hooks/jellyfin/jellyfinHookUtil.ts';
import { useKnownMedia } from '@/store/programmingSelector/selectors.ts';
import { flattenDeep, map } from 'lodash-es';
import { type MouseEventHandler, useCallback, useState } from 'react';
import { match } from 'ts-pattern';
import { Emby, Imported, Jellyfin, Plex } from '../../helpers/constants.ts';
import { enumerateEmbyItem } from '../../helpers/embyUtil.ts';
import { sequentialPromises } from '../../helpers/util.ts';
import { enumeratePlexItem } from '../../hooks/plex/plexHookUtil.ts';
import { useTunarrApi } from '../../hooks/useTunarrApi.ts';
import useStore from '../../store/index.ts';
import { clearSelectedMedia } from '../../store/programmingSelector/actions.ts';
import { type AddedMedia } from '../../types/index.ts';
import { useProgrammingSelectionContext } from '../useProgrammingSelectionContext.ts';

export const useAddSelectedItems = () => {
  const { onAddMediaSuccess, onAddSelectedMedia } =
    useProgrammingSelectionContext();
  const apiClient = useTunarrApi();
  const knownMedia = useKnownMedia();
  const selectedMedia = useStore((s) => s.selectedMedia);
  const [isLoading, setIsLoading] = useState(false);

  const addSelectedItems: MouseEventHandler = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsLoading(true);
      sequentialPromises(selectedMedia, (selectedMedia) =>
        match(selectedMedia)
          .returnType<Promise<AddedMedia[]>>()
          .with({ type: Plex }, async (selected) => {
            const media = knownMedia.getMediaOfType(
              selected.serverId,
              selected.id,
              Plex,
            );

            if (!media) {
              return [];
            }

            return map(
              await enumeratePlexItem(
                apiClient,
                selected.serverId,
                selected.serverName,
                media,
              )(),
              (item) => ({ media: item, type: Plex }),
            );
          })
          .with({ type: Jellyfin }, async (selected) => {
            const media = knownMedia.getMediaOfType(
              selected.serverId,
              selected.id,
              Jellyfin,
            );

            if (!media) {
              return [];
            }

            const items = await enumerateJellyfinItem(
              apiClient,
              selected.serverId,
              selected.serverName,
              media,
            )();

            return map(items, (item) => ({ media: item, type: Jellyfin }));
          })
          .with({ type: Emby }, async (selected) => {
            const media = knownMedia.getMediaOfType(
              selected.serverId,
              selected.id,
              Emby,
            );

            if (!media) {
              return [];
            }

            const items = await enumerateEmbyItem(
              apiClient,
              selected.serverId,
              selected.serverName,
              media,
            )();

            return map(items, (item) => ({ media: item, type: Emby }));
          })
          .with({ type: Imported }, async (selected) => {
            const media = knownMedia.getMediaOfType(
              selected.serverId,
              selected.id,
              Imported,
            );
            if (!media) return [];
            // switch (media.type) {
            //   case 'movie':
            //   case 'show':
            //   case 'season':
            //   case 'episode':
            // }
            const results = await apiClient.getProgramDescendants({
              params: { id: selected.id },
            });

            return results.map((program) => ({
              media: program,
              type: Imported,
            }));
          })
          .with({ type: 'custom-show' }, (selected) => {
            return Promise.resolve(
              map(selected.programs, (p) => ({
                type: 'custom-show',
                customShowId: selected.customShowId,
                totalDuration: selected.totalDuration,
                program: p,
              })),
            );
          })
          .exhaustive(),
      )
        .then(flattenDeep)
        .then(onAddSelectedMedia)
        .then(() => {
          clearSelectedMedia();
          setIsLoading(false);
          onAddMediaSuccess();
        })
        .catch(console.error);
    },
    [
      apiClient,
      knownMedia,
      onAddMediaSuccess,
      onAddSelectedMedia,
      selectedMedia,
    ],
  );

  return { addSelectedItems, isLoading };
};
