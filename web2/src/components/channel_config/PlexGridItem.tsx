import {
  CheckCircle,
  ExpandLess,
  ExpandMore,
  RadioButtonUnchecked,
} from '@mui/icons-material';
import {
  Button,
  Collapse,
  Divider,
  IconButton,
  ImageListItem,
  ImageListItemBar,
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
import {
  formatProgramDuration,
  prettyItemDuration,
} from '../../helpers/util.ts';
import { usePlexTyped } from '../../hooks/plexHooks.ts';
import useStore from '../../store/index.ts';
import {
  addKnownMediaForServer,
  addSelectedMedia,
} from '../../store/programmingSelector/actions.ts';

export interface PlexGridItemProps<T extends PlexMedia> {
  item: T;
  style?: React.CSSProperties;
  index?: number;
  length?: number;
  parent?: string;
}

export function PlexGridItem<T extends PlexMedia>(props: PlexGridItemProps<T>) {
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
          <PlexGridItem
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
      {hasChildren ? (
        <ListItemButton
          onClick={handleClick}
          dense
          sx={{ gridColumn: 'span 8' }}
        >
          {hasChildren && (
            <ListItemIcon>
              {open ? <ExpandLess /> : <ExpandMore />}
            </ListItemIcon>
          )}
          {/* <ListItemText primary={item.title} secondary={calculateItemRuntime()} /> */}
          <img src={`http://192.168.1.16:32400${item.thumb}`} width={100} />
          <Button onClick={(e) => addItem(e)}>
            {hasChildren ? 'Add All' : 'Add'}
          </Button>
        </ListItemButton>
      ) : (
        <ImageListItem
          key={item.guid}
          sx={{ width: 150, cursor: 'pointer' }}
          onClick={(e) => addItem(e)}
        >
          <img
            // srcSet={`${item.img}?w=248&fit=crop&auto=format&dpr=2 2x`}
            src={`http://192.168.1.16:32400${item.thumb}`}
            alt={item.title}
            loading="lazy"
          />
          <ImageListItemBar
            title={item.title}
            subtitle={<span>{formatProgramDuration(item.duration)}</span>}
            position="below"
            actionIcon={
              <IconButton
                sx={{ color: 'black' }}
                aria-label={`star ${item.title}`}
              >
                <CheckCircle />
                <RadioButtonUnchecked />
              </IconButton>
            }
            actionPosition="right"
          />
        </ImageListItem>
      )}
      {/* <Collapse in={open} timeout="auto" unmountOnExit>
        {renderChildren()}
      </Collapse> */}
      {/* <Divider variant="fullWidth" /> */}
    </React.Fragment>
  );
}
