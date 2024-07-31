import { AddCircle } from '@mui/icons-material';
import { CircularProgress, Tooltip } from '@mui/material';
import Button, { ButtonProps } from '@mui/material/Button';
import { flattenDeep, map } from 'lodash-es';
import { MouseEventHandler, ReactNode, useState } from 'react';
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
import { useKnownMedia } from '@/store/programmingSelector/selectors.ts';
import { enumerateJellyfinItem } from '@/hooks/jellyfin/jellyfinHookUtil.ts';

type Props = {
  onAdd: (items: AddedMedia[]) => void;
  onSuccess: () => void;
  buttonText?: string;
  tooltipTitle?: ReactNode;
} & ButtonProps;

export default function AddSelectedMediaButton({
  onAdd,
  onSuccess,
  buttonText,
  tooltipTitle,
  ...rest
}: Props) {
  const apiClient = useTunarrApi();
  const knownMedia = useKnownMedia();
  const selectedMedia = useStore((s) => s.selectedMedia);
  const [isLoading, setIsLoading] = useState(false);

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
      .then(onAdd)
      .then(() => {
        clearSelectedMedia();
        setIsLoading(false);
        onSuccess();
      })
      .catch(console.error);
  };

  return (
    <Tooltip
      title={
        selectedMedia.length === 0
          ? 'No programs selected'
          : tooltipTitle ?? 'Add all selected programs to channel'
      }
    >
      <span>
        <Button
          onClick={(e) => addSelectedItems(e)}
          disabled={selectedMedia.length === 0 || isLoading}
          {...(rest ?? {})}
          startIcon={
            isLoading ? (
              <CircularProgress size="20px" sx={{ mx: 1, color: 'inherit' }} />
            ) : (
              <AddCircle />
            )
          }
        >
          {buttonText ?? 'Add All'}
        </Button>
      </span>
    </Tooltip>
  );
}
