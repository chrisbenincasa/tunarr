import { isNil } from 'lodash-es';
import pluralize from 'pluralize';
import React, { ForwardedRef, forwardRef, useCallback } from 'react';
import {
  forJellyfinItem,
  forPlexMedia,
  prettyItemDuration,
} from '../../helpers/util.ts';

import { JellyfinItem } from '@tunarr/types/jellyfin';
import { MediaGridItem } from './MediaGridItem.tsx';

export interface JellyfinGridItemProps<T extends JellyfinItem> {
  item: T;
  style?: React.CSSProperties;
  index?: number;
  parent?: string;
  moveModal?: (index: number, item: T) => void;
  modalIndex?: number;
  onClick?: () => void;
  ref?: React.RefObject<HTMLDivElement>;
}

const genPlexChildPath = forPlexMedia({
  collection: (collection) =>
    `/library/collections/${collection.ratingKey}/children`,
  playlist: (playlist) => `/playlists/${playlist.ratingKey}/items`,
  default: (item) => `/library/metadata/${item.ratingKey}/children`,
});

const extractChildCount = forJellyfinItem({
  Season: (s) => s.ChildCount,
  Series: (s) => s.ChildCount,
  CollectionFolder: (s) => s.ChildCount,
  Playlist: (s) => s.ChildCount,
  default: 0,
});

const childItemType = forJellyfinItem({
  Season: 'episode',
  Series: 'season',
  CollectionFolder: 'item',
  Playlist: (pl) => (pl.MediaType === 'Audio' ? 'track' : 'video'),
  MusicArtist: 'album',
  MusicAlbum: 'track',
});

const subtitle = forJellyfinItem({
  Movie: (item) => (
    <span>{prettyItemDuration((item.RunTimeTicks ?? 0) / 1000)}</span>
  ),
  default: (item) => {
    const childCount = extractChildCount(item);
    if (isNil(childCount)) {
      return null;
    }

    return (
      <span>{`${childCount} ${pluralize(
        childItemType(item) ?? 'item',
        childCount,
      )}`}</span>
    );
  },
});

export const JellyfinGridItem = forwardRef(
  <T extends JellyfinItem>(
    props: JellyfinGridItemProps<T>,
    ref: ForwardedRef<HTMLDivElement>,
  ) => {
    return (
      <MediaGridItem<JellyfinItem>
        imgListItemRef={ref}
        item={props.item}
        extractors={{
          id: useCallback((item) => item.Id, []),
          isPlaylist: function (item: unknown): boolean {
            throw new Error('Function not implemented.');
          },
          hasThumbnail: function (item: unknown): boolean {
            throw new Error('Function not implemented.');
          },
          childCount: extractChildCount,
          isMusicItem: useCallback(
            (item) =>
              ['MusicArtist', 'MusicAlbum', 'Audio'].includes(item.Type),
            [],
          ),
          isEpisode: useCallback((item) => item.Type === 'Episode', []),
          title: function (item: unknown): string {
            throw new Error('Function not implemented.');
          },
          subtitle: subtitle,
          thumbnailUrl: function (item: unknown): string {
            throw new Error('Function not implemented.');
          },
        }}
        onClick={function (item: unknown): void {
          throw new Error('Function not implemented.');
        }}
        onSelect={function (item: unknown): void {
          throw new Error('Function not implemented.');
        }}
      />
    );
  },
);
