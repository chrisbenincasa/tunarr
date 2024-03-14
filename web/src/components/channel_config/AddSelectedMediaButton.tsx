import { Tooltip } from '@mui/material';
import Button, { ButtonProps } from '@mui/material/Button';
import { flattenDeep, map } from 'lodash-es';
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
  // const selectedMedia = useStore((s) =>
  //   filter(s.selectedMedia, (m): m is PlexSelectedMedia => m.type === 'plex'),
  // );
  const selectedMedia = useStore((s) => s.selectedMedia);

  const addSelectedItems = () => {
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
          return Promise.resolve([
            {
              type: 'custom-show',
              customShowId: selected.customShowId,
              program: selected.program,
            },
          ]);
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
          onClick={() => addSelectedItems()}
          disabled={selectedMedia.length === 0}
          {...(rest ?? {})}
        >
          Add All
        </Button>
      </span>
    </Tooltip>
  );
}
