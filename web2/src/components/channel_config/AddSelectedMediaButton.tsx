import { flattenDeep } from 'lodash-es';
import { sequentialPromises } from '../../helpers/util.ts';
import { enumeratePlexItem } from '../../hooks/plexHooks.ts';
import { addPlexMediaToCurrentChannel } from '../../store/channelEditor/actions.ts';
import useStore from '../../store/index.ts';
import Button from '@mui/material/Button';

type Props = {
  onSuccess: () => void;
};

export default function AddSelectedMediaButton({ onSuccess }: Props) {
  const knownMedia = useStore((s) => s.knownMediaByServer);
  const selectedMedia = useStore((s) => s.selectedMedia);

  const addSelectedItems = () => {
    sequentialPromises(selectedMedia, (selected) => {
      const media = knownMedia[selected.server][selected.guid];
      return enumeratePlexItem(selected.server, media)();
    })
      .then(flattenDeep)
      .then(addPlexMediaToCurrentChannel)
      .then(() => {
        onSuccess();
      })
      .catch(console.error);
  };

  return (
    <Button
      onClick={() => addSelectedItems()}
      disabled={selectedMedia.length === 0}
    >
      Add
    </Button>
  );
}
