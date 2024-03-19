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
  isPlexMusicAlbum,
  isPlexMusicArtist,
  isPlexShow,
  isTerminalItem,
} from '@tunarr/types/plex';
import { filter, first, map } from 'lodash-es';
import React, { MouseEvent, useCallback, useEffect, useState } from 'react';
import {
  forPlexMedia,
  prettyItemDuration,
  typedProperty,
} from '../../helpers/util.ts';
import { usePlexTyped } from '../../hooks/plexHooks.ts';
import useStore from '../../store/index.ts';
import {
  addKnownMediaForServer,
  addPlexSelectedMedia,
  removePlexSelectedMedia,
} from '../../store/programmingSelector/actions.ts';
import { PlexSelectedMedia } from '../../store/programmingSelector/store.ts';

export interface PlexListItemProps<T extends PlexMedia> {
  item: T;
  style?: React.CSSProperties;
  index?: number;
  length?: number;
  parent?: string;
}

const plexTypeString = forPlexMedia({
  show: 'Series',
  collection: 'Collection',
  movie: 'Movie',
  episode: 'Episode',
  track: 'Track',
  album: 'Album',
  artist: 'Artist',
  default: 'All',
});

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
  const selectedMedia = useStore((s) =>
    filter(s.selectedMedia, (m): m is PlexSelectedMedia => m.type === 'plex'),
  );
  const selectedMediaIds = map(selectedMedia, typedProperty('guid'));

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
        removePlexSelectedMedia(selectedServer!.name, [item.guid]);
      } else {
        addPlexSelectedMedia(selectedServer!.name, [item]);
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

  const getSecondaryText = () => {
    if (isPlexShow(item)) {
      return `${prettyItemDuration(item.duration)} each`;
    } else if (isTerminalItem(item)) {
      return prettyItemDuration(item.duration);
    } else if (isPlexCollection(item)) {
      const childCount = parseInt(item.childCount);
      const count = isNaN(childCount) ? 0 : childCount;
      return `${count} item${count === 0 || count > 1 ? 's' : ''}`;
    } else if (isPlexMusicArtist(item)) {
      return first(item.Genre)?.tag ?? ' ';
    } else if (isPlexMusicAlbum(item)) {
      return item.year ?? ' ';
    } else {
      return ' ';
    }
  };

  return (
    <React.Fragment key={item.guid}>
      <ListItemButton onClick={handleClick} dense>
        {hasChildren && (
          <ListItemIcon>{open ? <ExpandLess /> : <ExpandMore />}</ListItemIcon>
        )}
        <ListItemText primary={item.title} secondary={getSecondaryText()} />
        <Button onClick={(e) => handleItem(e)} variant="contained">
          {hasChildren
            ? `Add ${plexTypeString(item)}`
            : selectedMediaIds.includes(item.guid)
            ? 'Remove'
            : `Add ${plexTypeString(item)}`}
        </Button>
      </ListItemButton>
      <Collapse in={open} timeout="auto" unmountOnExit>
        {renderChildren()}
      </Collapse>
      <Divider variant="fullWidth" />
    </React.Fragment>
  );
}
