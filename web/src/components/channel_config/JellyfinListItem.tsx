import { prettyItemDuration, typedProperty } from '@/helpers/util.ts';
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
  List,
  ListItem,
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
import { first, isNull, map } from 'lodash-es';
import pluralize from 'pluralize';
import React, {
  Fragment,
  MouseEvent,
  useCallback,
  useEffect,
  useState,
} from 'react';

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
      <Skeleton height={60} />
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
    switch (item.Type) {
      case 'Audio':
      case 'Episode':
      case 'Movie':
        return prettyItemDuration((item.RunTimeTicks ?? 0) / 10_000);
      case 'MusicAlbum':
        return item.ProductionYear?.toString() ?? '';
      case 'MusicArtist':
        return first(item.Genres) ?? '';
      case 'MusicGenre':
      case 'Playlist':
      case 'PlaylistsFolder':
        return item.ChildCount ?? 0;
      case 'Season':
        return `${item.ChildCount} ${pluralize(
          'episode',
          item.ChildCount ?? 0,
        )}`;
      case 'Series':
        if (item.RecursiveItemCount) {
          return `${item.RecursiveItemCount} total ${pluralize(
            'episode',
            item.RecursiveItemCount,
          )}`;
        }
        return '';
      default:
        return '';
    }
  };

  return (
    <Fragment key={item.Id}>
      <ListItem divider disablePadding>
        <ListItemButton onClick={handleClick} dense sx={{ width: '100%' }}>
          {hasChildren && (
            <ListItemIcon>
              {open ? <ExpandLess /> : <ExpandMore />}
            </ListItemIcon>
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
      </ListItem>
      {hasChildren && (
        <Collapse in={open} timeout="auto" unmountOnExit sx={{ width: '100%' }}>
          {renderChildren()}
        </Collapse>
      )}
    </Fragment>
  );
}
