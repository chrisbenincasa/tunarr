import { isEmpty, isNil, isUndefined } from 'lodash-es';
import pluralize from 'pluralize';
import React, {
  ForwardedRef,
  forwardRef,
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  forJellyfinItem,
  isNonEmptyString,
  prettyItemDuration,
  toggle,
} from '../../helpers/util.ts';

import {
  addJellyfinSelectedMedia,
  addKnownMediaForJellyfinServer,
} from '@/store/programmingSelector/actions.ts';
import { useCurrentMediaSource } from '@/store/programmingSelector/selectors.ts';
import { JellyfinItem, JellyfinItemKind } from '@tunarr/types/jellyfin';
import { MediaGridItem } from './MediaGridItem.tsx';
import { useJellyfinLibraryItems } from '@/hooks/jellyfin/useJellyfinApi.ts';
import { GridItemProps } from './MediaItemGrid.tsx';

export interface JellyfinGridItemProps extends GridItemProps<JellyfinItem> {
  // item: JellyfinItem;
  style?: React.CSSProperties;
  parent?: string;
  onClick?: () => void;
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

const childJellyfinType = forJellyfinItem<JellyfinItemKind>({
  Season: 'Episode',
  Series: 'Season',
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
    const { item, index, moveModal } = props;
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

    const hasChildren = ['Series', 'Season'].includes(item.Type);
    const childKind = childJellyfinType(item);

    const { data: childItems } = useJellyfinLibraryItems(
      currentServer!.id,
      item.Id,
      childKind ? [childKind] : [],
      null,
      hasChildren && modalOpen,
    );

    useEffect(() => {
      if (
        !isUndefined(childItems) &&
        !isEmpty(childItems.Items) &&
        isNonEmptyString(currentServer?.id)
      ) {
        addKnownMediaForJellyfinServer(currentServer.id, childItems.Items);
      }
    }, [childItems, currentServer?.id]);

    const moveModalToItem = useCallback(() => {
      moveModal(index, item);
    }, [index, item, moveModal]);

    const handleItemClick = useCallback(() => {
      setModalOpen(toggle);
      moveModalToItem();
    }, [moveModalToItem]);

    return (
      currentServer && (
        <MediaGridItem
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
            selectedMedia: (item: JellyfinItem) => ({
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
