import { isNil } from 'lodash-es';
import pluralize from 'pluralize';
import React, { ForwardedRef, forwardRef, useCallback } from 'react';
import {
  forJellyfinItem,
  forPlexMedia,
  isNonEmptyString,
  prettyItemDuration,
} from '../../helpers/util.ts';

import { JellyfinItem } from '@tunarr/types/jellyfin';
import { MediaGridItem } from './MediaGridItem.tsx';
import { useCurrentMediaSource } from '@/store/programmingSelector/selectors.ts';
import { addJellyfinSelectedMedia } from '@/store/programmingSelector/actions.ts';

export interface JellyfinGridItemProps {
  item: JellyfinItem;
  style?: React.CSSProperties;
  index?: number;
  parent?: string;
  moveModal?: (index: number, item: JellyfinItem) => void;
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
    <span>{prettyItemDuration((item.RunTimeTicks ?? 0) / 10_000)}</span>
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

// // These never change -- keep a stable reference
// const jellyfinExtractors: GridItemMetadataExtractors<JellyfinItem> = {
//   id: item => item.Id,
//   isPlaylist: (item) => item.Type === 'Playlist',
//   hasThumbnail: (item) =>
//     isNonEmptyString((item.ImageTags ?? {})['Primary']),
//   childCount: extractChildCount,
//   isMusicItem: item => ['MusicArtist', 'MusicAlbum', 'Audio'].includes(item.Type),
//   isEpisode: item => item.Type === 'Episode',
//   title: (item) => item.Name ?? '',
//   subtitle: subtitle,
//   thumbnailUrl: (item) =>
//     `${currentServer.uri}/Items/${
//       item.Id
//     }/Images/Primary?fillHeight=300&fillWidth=200&quality=96&tag=${
//       (item.ImageTags ?? {})['Primary']
//     }`,
// }

export const JellyfinGridItem = forwardRef(
  (props: JellyfinGridItemProps, ref: ForwardedRef<HTMLDivElement>) => {
    const currentServer = useCurrentMediaSource('jellyfin');
    const extractId = useCallback((item: JellyfinItem) => item.Id, []);

    const isMusicItem = useCallback(
      (item: JellyfinItem) =>
        ['MusicArtist', 'MusicAlbum', 'Audio'].includes(item.Type),
      [],
    );

    const isEpisode = useCallback(
      (item: JellyfinItem) => item.Type === 'Episode',
      [],
    );

    return (
      currentServer && (
        <MediaGridItem<JellyfinItem>
          {...props}
          itemSource="jellyfin"
          ref={ref}
          // item={props.item}
          extractors={{
            id: extractId,
            isPlaylist: (item) => item.Type === 'Playlist',
            hasThumbnail: (item) =>
              isNonEmptyString((item.ImageTags ?? {})['Primary']),
            childCount: extractChildCount,
            isMusicItem,
            isEpisode,
            title: (item) => item.Name ?? '',
            subtitle: subtitle,
            thumbnailUrl: (item) =>
              `${currentServer.uri}/Items/${
                item.Id
              }/Images/Primary?fillHeight=300&fillWidth=200&quality=96&tag=${
                (item.ImageTags ?? {})['Primary']
              }`,
          }}
          onClick={() => {}}
          onSelect={(item) => addJellyfinSelectedMedia(currentServer, item)}
        />
      )
    );
  },
);
