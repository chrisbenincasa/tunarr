import { useCurrentMediaSource } from '@/store/programmingSelector/selectors.ts';
import { Button, ListItem, ListItemButton, ListItemText } from '@mui/material';
import {
  PlexMedia,
  isPlexCollection,
  isPlexMusicAlbum,
  isPlexMusicArtist,
  isPlexPlaylist,
  isPlexSeason,
  isPlexShow,
  isTerminalItem,
} from '@tunarr/types/plex';
import { filter, first, map } from 'lodash-es';
import pluralize from 'pluralize';
import React, { Fragment, MouseEvent, useCallback } from 'react';
import {
  forPlexMedia,
  prettyItemDuration,
  typedProperty,
} from '../../helpers/util.ts';
import useStore from '../../store/index.ts';
import {
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
  onPushParent: (item: T) => void;
}

const plexTypeString = forPlexMedia({
  show: 'Series',
  collection: 'Collection',
  movie: 'Movie',
  episode: 'Episode',
  track: 'Track',
  album: 'Album',
  artist: 'Artist',
  playlist: 'Playlist',
  default: 'All',
});

export function PlexListItem<T extends PlexMedia>(props: PlexListItemProps<T>) {
  const { item, style } = props;
  // We don't want to expand playlists
  const hasChildren = !isTerminalItem(item) && !isPlexPlaylist(item);
  const selectedServer = useCurrentMediaSource('plex');
  const selectedMedia = useStore((s) =>
    filter(s.selectedMedia, (m): m is PlexSelectedMedia => m.type === 'plex'),
  );
  const selectedMediaIds = map(selectedMedia, typedProperty('id'));

  const handleClick = () => {
    if (hasChildren) {
      props.onPushParent(item);
    }
  };

  const handleItem = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();

      if (selectedMediaIds.includes(item.guid)) {
        removePlexSelectedMedia(selectedServer!.id, [item.guid]);
      } else {
        addPlexSelectedMedia(selectedServer!, [item]);
      }
    },
    [item, selectedServer, selectedMediaIds],
  );

  const getSecondaryText = () => {
    if (isPlexShow(item)) {
      return `${prettyItemDuration(item.duration ?? 0)} each`;
    } else if (isTerminalItem(item)) {
      return prettyItemDuration(item.duration ?? 0);
    } else if (isPlexCollection(item)) {
      const childCount = parseInt(item.childCount);
      const count = isNaN(childCount) ? 0 : childCount;
      return `${count} item${count === 0 || count > 1 ? 's' : ''}`;
    } else if (isPlexMusicArtist(item)) {
      return first(item.Genre)?.tag ?? ' ';
    } else if (isPlexMusicAlbum(item)) {
      return item.year ?? ' ';
    } else if (isPlexSeason(item)) {
      return `${item.leafCount} ${pluralize('episode', item.leafCount)}`;
    } else {
      return ' ';
    }
  };

  return (
    <Fragment key={item.guid}>
      <ListItem divider disablePadding style={style}>
        <ListItemButton
          onClick={handleClick}
          dense
          sx={{
            width: '100%',
            cursor: isTerminalItem(item) ? 'default' : undefined,
          }}
        >
          <ListItemText primary={item.title} secondary={getSecondaryText()} />
          <Button onClick={(e) => handleItem(e)} variant="contained">
            {hasChildren
              ? `Add ${plexTypeString(item)}`
              : selectedMediaIds.includes(item.guid)
              ? 'Remove'
              : `Add ${plexTypeString(item)}`}
          </Button>
        </ListItemButton>
      </ListItem>
    </Fragment>
  );
}
