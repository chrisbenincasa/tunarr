import { enumerateJellyfinItem } from '@/hooks/jellyfin/jellyfinHookUtil.ts';
import { useKnownMedia } from '@/store/programmingSelector/selectors.ts';
import { flattenDeep, map } from 'lodash-es';
import { type MouseEventHandler, useCallback, useState } from 'react';
import { match, P } from 'ts-pattern';
import { getApiProgramsByIdDescendants } from '../../generated/sdk.gen.ts';
import { Emby, Imported, Jellyfin, Plex } from '../../helpers/constants.ts';
import { enumerateEmbyItem } from '../../helpers/embyUtil.ts';
import { sequentialPromises } from '../../helpers/util.ts';
import { enumeratePlexItem } from '../../hooks/plex/plexHookUtil.ts';
import useStore from '../../store/index.ts';
import { clearSelectedMedia } from '../../store/programmingSelector/actions.ts';
import type { AddedPlexMedia } from '../../types/index.ts';
import { type AddedMedia } from '../../types/index.ts';
import { useProgrammingSelectionContext } from '../useProgrammingSelectionContext.ts';

export const useAddSelectedItems = () => {
  const { onAddMediaSuccess, onAddSelectedMedia } =
    useProgrammingSelectionContext();
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
          .with({ type: Plex, persisted: false }, async (selected) => {
            const media = knownMedia.getMediaOfType(
              selected.mediaSource.id,
              selected.id,
              Plex,
            );

            if (!media) {
              return [];
            }

            return map(
              await enumeratePlexItem(selected.mediaSource, media),
              (item) => ({ media: item, type: Plex }) satisfies AddedPlexMedia,
            );
          })
          .with({ type: Jellyfin, persisted: false }, async (selected) => {
            const media = knownMedia.getMediaOfType(
              selected.mediaSource.id,
              selected.id,
              Jellyfin,
            );

            if (!media) {
              return [];
            }

            const items = await enumerateJellyfinItem(
              selected.mediaSource.id,
              selected.libraryId,
              media,
            );

            return map(items, (item) => ({ media: item, type: Jellyfin }));
          })
          .with({ type: Emby, persisted: false }, async (selected) => {
            const media = knownMedia.getMediaOfType(
              selected.mediaSource.id,
              selected.id,
              Emby,
            );

            if (!media) {
              return [];
            }

            const items = await enumerateEmbyItem(
              selected.mediaSource.id,
              selected.libraryId,
              media,
            );

            return map(items, (item) => ({ media: item, type: Emby }));
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
          .with({ type: P.select() }, async (typ, selected) => {
            const media = knownMedia.getMediaOfType(
              selected.mediaSource.id,
              selected.id,
              typ,
            );

            if (!media) {
              console.warn('Media not found in local map', selected);
              return [];
            }

            const { data } = await getApiProgramsByIdDescendants({
              path: {
                id: selected.id,
              },
              throwOnError: true,
            });

            return data.map((program) => ({
              media: program,
              type: Imported,
            }));
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
    [knownMedia, onAddMediaSuccess, onAddSelectedMedia, selectedMedia],
  );

  return { addSelectedItems, isLoading };
};
