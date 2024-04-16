import { Tooltip } from '@mui/material';
import Button, { ButtonProps } from '@mui/material/Button';
import { flattenDeep, map } from 'lodash-es';
import { MouseEventHandler } from 'react';
import {
  forSelectedMediaType,
  sequentialPromises,
} from '../../helpers/util.ts';
import { enumeratePlexItem } from '../../hooks/plexHooks.ts';
import useStore from '../../store/index.ts';
import { clearSelectedMedia } from '../../store/programmingSelector/actions.ts';
import { CustomShowSelectedMedia } from '../../store/programmingSelector/store.ts';
import { AddedCustomShowProgram, AddedMedia } from '../../types/index.ts';

type Props = {
  onAdd: (items: AddedMedia[]) => void;
  onSuccess: () => void;
} & ButtonProps;

export default function AddSelectedMediaButton({
  onAdd,
  onSuccess,
  ...rest
}: Props) {
  const knownMedia = useStore((s) => s.knownMediaByServer);
  const selectedMedia = useStore((s) => s.selectedMedia);

  const addSelectedItems: MouseEventHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    sequentialPromises(
      selectedMedia,
      forSelectedMediaType<Promise<AddedMedia[]>>({
        plex: async (selected) => {
          const media = knownMedia[selected.server][selected.guid];
          const items = await enumeratePlexItem(selected.server, media)();
          return map(items, (item) => ({ media: item, type: 'plex' }));
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
        onSuccess();
      })
      .catch(console.error);
  };

  return (
    <Tooltip title="Add all programs to channel">
      <span>
        <Button
          onClick={(e) => addSelectedItems(e)}
          disabled={selectedMedia.length === 0}
          {...(rest ?? {})}
        >
          Add All
        </Button>
      </span>
    </Tooltip>
  );
}
