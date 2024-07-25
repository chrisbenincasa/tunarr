import { isEmpty, isEqual, isNil, isUndefined } from 'lodash-es';
import pluralize from 'pluralize';
import React, {
  ForwardedRef,
  forwardRef,
  memo,
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
import { SelectedMedia } from '@/store/programmingSelector/store.ts';

export interface JellyfinGridItemProps extends GridItemProps<JellyfinItem> {}

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

export const JellyfinGridItem = memo(
  forwardRef(
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

      const thumbnailUrlFunc = useCallback(
        (item: JellyfinItem) => {
          return `${currentServer?.uri}/Items/${
            item.Id
          }/Images/Primary?fillHeight=300&fillWidth=200&quality=96&tag=${
            (item.ImageTags ?? {})['Primary']
          }`;
        },
        [currentServer],
      );

      const selectedMediaFunc = useCallback(
        (item: JellyfinItem): SelectedMedia => {
          return {
            type: 'jellyfin',
            serverId: currentServer!.id,
            childCount: extractChildCount(item),
            id: item.Id,
          };
        },
        [currentServer],
      );

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
              thumbnailUrl: thumbnailUrlFunc,
              selectedMedia: selectedMediaFunc,
            }}
            onClick={handleItemClick}
            onSelect={(item) => addJellyfinSelectedMedia(currentServer, item)}
          />
        )
      );
    },
  ),
  (prev, next) => {
    // if (!isEqual(prev, next)) {
    //   console.log(prev, next);
    // }
    return isEqual(prev, next);
  },
);
