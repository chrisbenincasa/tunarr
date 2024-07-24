import { isNil } from 'lodash-es';
import pluralize from 'pluralize';
import React, { ForwardedRef, forwardRef, useCallback, useState } from 'react';
import {
  forJellyfinItem,
  isNonEmptyString,
  prettyItemDuration,
  toggle,
} from '../../helpers/util.ts';

import { addJellyfinSelectedMedia } from '@/store/programmingSelector/actions.ts';
import { useCurrentMediaSource } from '@/store/programmingSelector/selectors.ts';
import { JellyfinItem } from '@tunarr/types/jellyfin';
import { MediaGridItem } from './MediaGridItem.tsx';
import { useInfiniteJellyfinLibraryItems } from '@/hooks/jellyfin/useJellyfinApi.ts';

export interface JellyfinGridItemProps {
  item: JellyfinItem;
  style?: React.CSSProperties;
  index: number;
  parent?: string;
  moveModal: /*(index: number, item: JellyfinItem)*/ () => void;
  modalIndex?: number;
  onClick?: () => void;
  ref?: React.RefObject<HTMLDivElement>;
}

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

export const JellyfinGridItem = forwardRef(
  (props: JellyfinGridItemProps, ref: ForwardedRef<HTMLDivElement>) => {
    const [modalOpen, setModalOpen] = useState(false);
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

    const hasChildren = ['Series', 'Season'].includes(props.item.Type);

    const result = useInfiniteJellyfinLibraryItems(
      currentServer!.id,
      props.item.Id,
      ['Season'],
      hasChildren && modalOpen,
    );
    console.log(result);

    const handleItemClick = useCallback(() => {
      setModalOpen(toggle);
      props.moveModal();
    }, [props]);

    return (
      currentServer && (
        <MediaGridItem<JellyfinItem>
          {...props}
          key={props.item.Id}
          itemSource="jellyfin"
          ref={ref}
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
            selectedMedia: (item) => ({
              type: 'jellyfin',
              serverId: currentServer.id,
              childCount: extractChildCount(item),
              id: item.Id,
            }),
          }}
          onClick={handleItemClick}
          onSelect={(item) => addJellyfinSelectedMedia(currentServer, item)}
        />
      )
    );
  },
);
