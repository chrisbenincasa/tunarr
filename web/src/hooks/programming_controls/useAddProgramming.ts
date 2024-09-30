import { enumerateJellyfinItem } from '@/hooks/jellyfin/jellyfinHookUtil.ts';
import {
  addSelectedMediaToEntityEditor,
  startProgramAddOperation,
  stopProgramAddOperation,
} from '@/store/entityEditor/actions.ts';
import { useKnownMedia } from '@/store/programmingSelector/selectors.ts';
import { useCurrentEditor } from '@/store/selectors.ts';
import { flattenDeep, map } from 'lodash-es';
import { useSnackbar } from 'notistack';
import { MouseEventHandler, useState } from 'react';
import {
  forSelectedMediaType,
  sequentialPromises,
} from '../../helpers/util.ts';
import { enumeratePlexItem } from '../../hooks/plex/plexHookUtil.ts';
import { useTunarrApi } from '../../hooks/useTunarrApi.ts';
import useStore from '../../store/index.ts';
import { clearSelectedMedia } from '../../store/programmingSelector/actions.ts';
import { CustomShowSelectedMedia } from '../../store/programmingSelector/store.ts';
import { AddedCustomShowProgram, AddedMedia } from '../../types/index.ts';

export const useAddSelectedItems = (
  onAddSelectedMedia: (items: AddedMedia[]) => void,
  onAddMediaSuccess: () => void,
) => {
  const [currentEditor] = useState(useStore((s) => s.currentEditor));
  const currentEditorState = useCurrentEditor();
  console.log(currentEditorState);
  const apiClient = useTunarrApi();
  const knownMedia = useKnownMedia();
  const selectedMedia = useStore((s) => s.selectedMedia);
  const [isLoading, setIsLoading] = useState(false);
  const snackbar = useSnackbar();

  const addSelectedItems: MouseEventHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsLoading(true);
    startProgramAddOperation();
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
      .then((flattened) => {
        // onAddSelectedMedia(flattened);
        console.log('adding', currentEditor, flattened);
        addSelectedMediaToEntityEditor(currentEditor!, flattened);
        clearSelectedMedia();
        onAddMediaSuccess();
      })
      .catch((e) => {
        snackbar.enqueueSnackbar(
          'Error while adding programs. Check browser console log for details.',
          {
            variant: 'error',
          },
        );
        console.error(e);
      })
      .finally(() => {
        setIsLoading(false);
        stopProgramAddOperation(currentEditor!);
      });
  };

  return { addSelectedItems, isLoading };
};
