import { enumerateJellyfinItem } from '@/hooks/jellyfin/jellyfinHookUtil.ts';
import { useAddProgrammingContext } from '@/hooks/programming_controls/useAddProgrammingContext.ts';
import { useKnownMedia } from '@/store/programmingSelector/selectors.ts';
import { flattenDeep, map } from 'lodash-es';
import { MouseEventHandler, useState } from 'react';
import {
  forSelectedMediaType,
  sequentialPromises,
} from '../../helpers/util.ts';
import useStore from '../../store/index.ts';
import { clearSelectedMedia } from '../../store/programmingSelector/actions.ts';
import { CustomShowSelectedMedia } from '../../store/programmingSelector/store.ts';
import { AddedCustomShowProgram, AddedMedia } from '../../types/index.ts';
import { enumeratePlexItem } from '../plex/plexHookUtil.ts';
import { useTunarrApi } from '../useTunarrApi.ts';

export const useAddSelectedMediaItems = () => {
  const apiClient = useTunarrApi();
  const knownMedia = useKnownMedia();
  const selectedMedia = useStore((s) => s.selectedMedia);
  const [isLoading, setIsLoading] = useState(false);
  const { onAddSelectedMedia, onAddMediaSuccess } = useAddProgrammingContext();

  const addSelectedItems: MouseEventHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsLoading(true);
    sequentialPromises(
      selectedMedia,
      forSelectedMediaType<Promise<AddedMedia[]>>({
        plex: async (selected) => {
          const media = knownMedia.getMediaOfType(
            selected.serverId,
            selected.id,
            'plex',
          );

          if (!media) {
            return [];
          }

          const items = await enumeratePlexItem(
            apiClient,
            selected.serverId,
            selected.serverName,
            media,
          )();

          return map(items, (item) => ({ media: item, type: 'plex' }));
        },
        jellyfin: async (selected) => {
          const media = knownMedia.getMediaOfType(
            selected.serverId,
            selected.id,
            'jellyfin',
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

          return map(items, (item) => ({ media: item, type: 'jellyfin' }));
        },
        'custom-show': (
          selected: CustomShowSelectedMedia,
        ): Promise<AddedCustomShowProgram[]> => {
          return Promise.resolve(
            map(selected.programs, (p) => ({
              type: 'custom-show',
              customShowId: selected.customShowId,
              totalDuration: selected.totalDuration,
              program: p,
            })),
          );
        },
        default: Promise.resolve([]),
      }),
    )
      .then(flattenDeep)
      .then(onAddSelectedMedia)
      .then(() => {
        clearSelectedMedia();
        setIsLoading(false);
        onAddMediaSuccess();
      })
      .catch(console.error);
  };

  return { addSelectedItems, isLoading };
};
