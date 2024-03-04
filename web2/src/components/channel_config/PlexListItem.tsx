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
  PlexChildMediaApiType,
  PlexMedia,
  isPlexCollection,
  isPlexSeason,
  isPlexShow,
  isTerminalItem,
} from '@tunarr/types/plex';
import React, { MouseEvent, useCallback, useEffect, useState } from 'react';
import { prettyItemDuration } from '../../helpers/util.ts';
import { usePlexTyped } from '../../hooks/plexHooks.ts';
import useStore from '../../store/index.ts';
import {
  addKnownMediaForServer,
  addSelectedMedia,
  removeSelectedMedia,
} from '../../store/programmingSelector/actions.ts';

export interface PlexListItemProps<T extends PlexMedia> {
  item: T;
  style?: React.CSSProperties;
  index?: number;
  length?: number;
  parent?: string;
}

export function PlexListItem<T extends PlexMedia>(props: PlexListItemProps<T>) {
  const server = useStore((s) => s.currentServer!); // We have to have a server at this point
  const [open, setOpen] = useState(false);
  const { item } = props;
  const hasChildren = !isTerminalItem(item);
  const childPath = isPlexCollection(item) ? 'collections' : 'metadata';
  const { isPending, data: children } = usePlexTyped<PlexChildMediaApiType<T>>(
    server.name,
    `/library/${childPath}/${props.item.ratingKey}/children`,
    hasChildren && open,
  );
  const selectedServer = useStore((s) => s.currentServer);
  const selectedMedia = useStore((s) => s.selectedMedia);
  const selectedMediaIds = selectedMedia.map((item) => item['guid']);

  const handleClick = () => {
    setOpen(!open);
  };

  useEffect(() => {
    if (children) {
      addKnownMediaForServer(server.name, children.Metadata, item.guid);
    }
  }, [item.guid, server.name, children]);

  const handleItem = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();

      if (selectedMediaIds.includes(item.guid)) {
        removeSelectedMedia(selectedServer!.name, [item.guid]);
      } else {
        addSelectedMedia(selectedServer!.name, [item]);
      }
    },
    [item, selectedServer, selectedMediaIds],
  );

  const renderChildren = () => {
    return isPending ? (
      <Skeleton />
    ) : (
      <List sx={{ pl: 4 }}>
        {children?.Metadata.map((child, idx, arr) => (
          <PlexListItem
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
    } else if (isTerminalItem(item)) {
      return prettyItemDuration(item.duration);
    } else if (isPlexCollection(item)) {
      const childCount = parseInt(item.childCount);
      const count = isNaN(childCount) ? 0 : childCount;
      return `${count} item${count === 0 || count > 1 ? 's' : ''}`;
    }
  };

  return (
    <React.Fragment key={item.guid}>
      <ListItemButton onClick={handleClick} dense>
        {hasChildren && (
          <ListItemIcon>{open ? <ExpandLess /> : <ExpandMore />}</ListItemIcon>
        )}
        <ListItemText primary={item.title} secondary={calculateItemRuntime()} />
        <Button onClick={(e) => handleItem(e)}>
          {hasChildren
            ? 'Add All'
            : selectedMediaIds.includes(item.guid)
            ? 'Remove'
            : 'Add'}
        </Button>
      </ListItemButton>
      <Collapse in={open} timeout="auto" unmountOnExit>
        {renderChildren()}
      </Collapse>
      <Divider variant="fullWidth" />
    </React.Fragment>
  );
}
