import { typedProperty } from '@/helpers/util.ts';
import { useJellyfinLibraryItems } from '@/hooks/jellyfin/useJellyfinApi.ts';
import {
  addJellyfinSelectedMedia,
  addKnownMediaForJellyfinServer,
  removePlexSelectedMedia,
} from '@/store/programmingSelector/actions.ts';
import {
  useCurrentMediaSource,
  useSelectedMedia,
} from '@/store/programmingSelector/selectors.ts';
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
  JellyfinItem,
  JellyfinItemKind,
  isTerminalJellyfinItem,
} from '@tunarr/types/jellyfin';
import { isNull, map } from 'lodash-es';
import React, { MouseEvent, useCallback, useEffect, useState } from 'react';

export interface JellyfinListItemProps {
  item: JellyfinItem;
  style?: React.CSSProperties;
  index?: number;
  length?: number;
  parent?: string;
}

function jellyfinChildType(item: JellyfinItem): JellyfinItemKind | null {
  switch (item.Type) {
    case 'Audio':
    case 'Episode':
    case 'Movie':
      return null;
    case 'MusicAlbum':
      return 'Audio';
    case 'MusicArtist':
      return 'MusicAlbum';
    case 'MusicGenre':
      return 'MusicAlbum';
    // case 'Playlist':
    // case 'PlaylistsFolder':
    // case 'Program':
    // case 'Recording':
    case 'Season':
      return 'Episode';
    case 'Series':
      return 'Season';
    // case 'Studio':
    // case 'Trailer':
    // case 'TvChannel':
    // case 'TvProgram':
    default:
      return null;
  }
}

export function JellyfinListItem(props: JellyfinListItemProps) {
  const selectedServer = useCurrentMediaSource('jellyfin')!;
  const [open, setOpen] = useState(false);
  const { item } = props;
  const hasChildren = !isTerminalJellyfinItem(item);
  const childType = jellyfinChildType(item);
  const { isPending, data: children } = useJellyfinLibraryItems(
    selectedServer.id,
    props.item.Id,
    childType ? [childType] : [],
    null,
    !isNull(childType) && open,
  );
  // const selectedServer = useCurrentMediaSource('plex');
  // const selectedMedia = useStore((s) =>
  //   filter(s.selectedMedia, (m): m is PlexSelectedMedia => m.type === 'plex'),
  // );
  const selectedMedia = useSelectedMedia('jellyfin');
  const selectedMediaIds = map(selectedMedia, typedProperty('id'));

  const handleClick = () => {
    setOpen(!open);
  };

  useEffect(() => {
    if (children) {
      addKnownMediaForJellyfinServer(
        selectedServer.id,
        children.Items,
        item.Id,
      );
    }
  }, [item.Id, selectedServer.id, children]);

  const handleItem = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();

      if (selectedMediaIds.includes(item.Id)) {
        removePlexSelectedMedia(selectedServer.id, [item.Id]);
      } else {
        addJellyfinSelectedMedia(selectedServer, item);
      }
    },
    [item, selectedServer, selectedMediaIds],
  );

  const renderChildren = () => {
    return isPending ? (
      <Skeleton />
    ) : (
      <List sx={{ pl: 4 }}>
        {children?.Items.map((child, idx, arr) => (
          <JellyfinListItem
            key={child.Id}
            item={child}
            index={idx}
            length={arr.length}
          />
        ))}
      </List>
    );
  };

  const getSecondaryText = () => {
    // if (isPlexShow(item)) {
    //   return `${prettyItemDuration(item.duration)} each`;
    // } else if (isTerminalItem(item)) {
    //   return prettyItemDuration(item.duration);
    // } else if (isPlexCollection(item)) {
    //   const childCount = parseInt(item.childCount);
    //   const count = isNaN(childCount) ? 0 : childCount;
    //   return `${count} item${count === 0 || count > 1 ? 's' : ''}`;
    // } else if (isPlexMusicArtist(item)) {
    //   return first(item.Genre)?.tag ?? ' ';
    // } else if (isPlexMusicAlbum(item)) {
    //   return item.year ?? ' ';
    // } else {
    //   return ' ';
    // }
    return ' ';
  };

  return (
    <React.Fragment key={item.Id}>
      <ListItemButton onClick={handleClick} dense sx={{ width: '100%' }}>
        {hasChildren && (
          <ListItemIcon>{open ? <ExpandLess /> : <ExpandMore />}</ListItemIcon>
        )}
        <ListItemText primary={item.Name} secondary={getSecondaryText()} />
        <Button onClick={(e) => handleItem(e)} variant="contained">
          {hasChildren
            ? `Add ${item.Type}`
            : selectedMediaIds.includes(item.Id)
            ? 'Remove'
            : `Add ${item.Type}`}
        </Button>
      </ListItemButton>
      <Collapse in={open} timeout="auto" unmountOnExit sx={{ width: '100%' }}>
        {renderChildren()}
      </Collapse>
      <Divider variant="fullWidth" />
    </React.Fragment>
  );
}
