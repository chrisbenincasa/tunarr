import { Tooltip } from '@mui/material';
import Button, { ButtonProps } from '@mui/material/Button';
import { filter, flattenDeep } from 'lodash-es';
import { sequentialPromises } from '../../helpers/util.ts';
import { EnrichedPlexMedia, enumeratePlexItem } from '../../hooks/plexHooks.ts';
import useStore from '../../store/index.ts';
import { clearSelectedMedia } from '../../store/programmingSelector/actions.ts';
import { PlexSelectedMedia } from '../../store/programmingSelector/store.ts';

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
  // TODO support custom shows
  const selectedMedia = useStore((s) =>
    filter(s.selectedMedia, (m): m is PlexSelectedMedia => m.type === 'plex'),
  );

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
