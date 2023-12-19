import { Button, ListItem, ListItemText } from '@mui/material';
import { PlexMovie } from 'dizquetv-types/plex';
import { prettyItemDuration } from '../../helpers/util.ts';
import useStore from '../../store/index.ts';
import { addSelectedMedia } from '../../store/programmingSelector/actions.ts';
import { PlexListItemProps } from './ProgrammingSelector.tsx';

export function PlexMovieListItem(props: PlexListItemProps<PlexMovie>) {
  const { item, index } = props;
  const selectedServer = useStore((s) => s.currentServer);

  const addItem = () => {
    addSelectedMedia(selectedServer!.name, [item]);
  };

  return (
    <ListItem key={index} component="div" disablePadding divider>
      <ListItemText
        primary={item.title}
        secondary={prettyItemDuration(item.duration)}
      />
      <Button onClick={addItem}>Add</Button>
    </ListItem>
  );
}
