import { Tooltip } from '@mui/material';
import Button, { ButtonProps } from '@mui/material/Button';
import { flattenDeep } from 'lodash-es';
import { sequentialPromises } from '../../helpers/util.ts';
import { EnrichedPlexMedia, enumeratePlexItem } from '../../hooks/plexHooks.ts';
import useStore from '../../store/index.ts';
import { clearSelectedMedia } from '../../store/programmingSelector/actions.ts';

type Props = {
  onAdd: (items: EnrichedPlexMedia[]) => void;
  onSuccess: () => void;
} & ButtonProps;

export default function AddSelectedMediaButton({
  onAdd,
  onSuccess,
  ...rest
}: Props) {
  const knownMedia = useStore((s) => s.knownMediaByServer);
  const selectedMedia = useStore((s) => s.selectedMedia);

  const addSelectedItems = () => {
    sequentialPromises(selectedMedia, (selected) => {
      const media = knownMedia[selected.server][selected.guid];
      return enumeratePlexItem(selected.server, media)();
    })
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
      <Button
        onClick={() => addSelectedItems()}
        disabled={selectedMedia.length === 0}
        {...(rest ?? {})}
      >
        Add All
      </Button>
    </Tooltip>
  );
}
