import { prettyItemDuration, typedProperty } from '@/helpers/util.ts';
import {
  addJellyfinSelectedMedia,
  removePlexSelectedMedia,
} from '@/store/programmingSelector/actions.ts';
import {
  useCurrentMediaSource,
  useSelectedMedia,
} from '@/store/programmingSelector/selectors.ts';
import { Button, ListItem, ListItemButton, ListItemText } from '@mui/material';
import { JellyfinItem, isTerminalJellyfinItem } from '@tunarr/types/jellyfin';
import { first, isNil, map } from 'lodash-es';
import pluralize from 'pluralize';
import React, { Fragment, MouseEvent, useCallback } from 'react';

export interface JellyfinListItemProps {
  item: JellyfinItem;
  style?: React.CSSProperties;
  index?: number;
  length?: number;
  parent?: string;
  onPushParent: (item: JellyfinItem) => void;
}

export function JellyfinListItem(props: JellyfinListItemProps) {
  const selectedServer = useCurrentMediaSource('jellyfin')!;
  const { item, style, onPushParent } = props;
  const childCount = item.RecursiveItemCount ?? item.ChildCount ?? 0;
  const hasChildren = !isTerminalJellyfinItem(item) && childCount > 0;

  const selectedMedia = useSelectedMedia('jellyfin');
  const selectedMediaIds = map(selectedMedia, typedProperty('id'));

  const handleClick = () => {
    if (!isTerminalJellyfinItem(item)) {
      onPushParent(item);
    }
  };

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

  const getSecondaryText = () => {
    switch (item.Type) {
      case 'Audio':
      case 'Episode':
      case 'Movie':
      case 'Video':
      case 'Trailer':
        return prettyItemDuration((item.RunTimeTicks ?? 0) / 10_000);
      case 'MusicAlbum':
        return item.ProductionYear?.toString() ?? '';
      case 'MusicArtist':
        return first(item.Genres) ?? '';
      case 'MusicGenre':
      case 'Playlist':
      case 'PlaylistsFolder':
      case 'Folder':
      case 'BoxSet':
        return isNil(item.ChildCount)
          ? ''
          : `${item.ChildCount ?? 0} ${pluralize(
              'item',
              item.ChildCount ?? 0,
            )}`;
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
      <ListItem divider disablePadding style={style}>
        <ListItemButton
          disabled={!isTerminalJellyfinItem(item) && childCount === 0}
          onClick={handleClick}
          dense
          sx={{
            width: '100%',
            cursor: isTerminalJellyfinItem(item) ? 'default' : undefined,
          }}
        >
          <ListItemText primary={item.Name} secondary={getSecondaryText()} />
          <Button
            disabled={!isTerminalJellyfinItem(item) && childCount === 0}
            onClick={(e) => handleItem(e)}
            variant="contained"
          >
            {hasChildren
              ? `Add ${item.Type}`
              : selectedMediaIds.includes(item.Id)
              ? 'Remove'
              : `Add ${item.Type}`}
          </Button>
        </ListItemButton>
      </ListItem>
    </Fragment>
  );
}
