import { ExpandLess, ExpandMore } from '@mui/icons-material';
import {
  Button,
  Collapse,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Skeleton,
} from '@mui/material';
import {
  PlexEpisode,
  PlexEpisodeView,
  PlexSeasonView,
  PlexTvSeason,
  PlexTvShow,
  isPlexEpisode,
  isPlexSeason,
  isPlexShow,
  isTerminalItem,
} from 'dizquetv-types/plex';
import React, { useCallback, useEffect, useState, MouseEvent } from 'react';
import { usePlexTyped } from '../../hooks/plexHooks.ts';
import useStore from '../../store/index.ts';
import {
  addKnownMediaForServer,
  addSelectedMedia,
} from '../../store/programmingSelector/actions.ts';
import { PlexListItemProps } from './ProgrammingSelector.tsx';
import { prettyItemDuration } from '../../helpers/util.ts';

export function PlexTvListItem(
  props: PlexListItemProps<PlexTvShow | PlexTvSeason | PlexEpisode>,
) {
  const server = useStore((s) => s.currentServer!); // We have to have a server at this point
  const [open, setOpen] = useState(false);
  const { item } = props;
  const hasChildren = !isTerminalItem(item);
  const { isPending, data: children } = usePlexTyped<
    PlexSeasonView | PlexEpisodeView
  >(
    server.name,
    `/library/metadata/${props.item.ratingKey}/children`,
    hasChildren && open,
  );
  const selectedServer = useStore((s) => s.currentServer);

  const handleClick = () => {
    setOpen(!open);
  };

  useEffect(() => {
    if (children) {
      addKnownMediaForServer(server.name, children.Metadata, item.guid);
    }
  }, [item.guid, server.name, children]);

  const addItem = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      addSelectedMedia(selectedServer!.name, [item]);
    },
    [item, selectedServer],
  );

  const renderChildren = () => {
    return isPending ? (
      <Skeleton />
    ) : (
      <List sx={{ pl: 4 }}>
        {children?.Metadata.map((child, idx, arr) => (
          <PlexTvListItem
            key={child.guid}
            item={child}
            index={idx}
            length={arr.length}
          />
        ))}
      </List>
    );
  };

  const calculateItemRuntime = () => {
    if (isPlexShow(item)) {
      return `${prettyItemDuration(item.duration)} each`;
    } else if (isPlexSeason(item)) {
      // return item.leafCount * item.duration;
      return;
    } else if (isPlexEpisode(item)) {
      return prettyItemDuration(item.duration);
    }
  };

  return (
    <React.Fragment key={item.guid}>
      <ListItemButton onClick={handleClick} dense>
        {hasChildren && (
          <ListItemIcon>{open ? <ExpandLess /> : <ExpandMore />}</ListItemIcon>
        )}
        <ListItemText primary={item.title} secondary={calculateItemRuntime()} />
        <Button onClick={(e) => addItem(e)}>
          {hasChildren ? 'Add All' : 'Add'}
        </Button>
      </ListItemButton>
      <Collapse in={open} timeout="auto" unmountOnExit>
        {renderChildren()}
      </Collapse>
      <Divider variant="fullWidth" />
    </React.Fragment>
  );
}
