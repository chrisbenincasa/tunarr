import { isEqual, isNil } from 'lodash-es';
import pluralize from 'pluralize';
import {
  ForwardedRef,
  forwardRef,
  memo,
  useCallback,
  useMemo,
  useState,
} from 'react';
import {
  forJellyfinItem,
  isNonEmptyString,
  prettyItemDuration,
  toggle,
} from '../../helpers/util.ts';

import { useJellyfinLibraryItems } from '@/hooks/jellyfin/useJellyfinApi.ts';
import { addJellyfinSelectedMedia } from '@/store/programmingSelector/actions.ts';
import { useCurrentMediaSource } from '@/store/programmingSelector/selectors.ts';
import { SelectedMedia } from '@/store/programmingSelector/store.ts';
import { JellyfinItem, JellyfinItemKind } from '@tunarr/types/jellyfin';
import { MediaGridItem } from './MediaGridItem.tsx';
import { GridItemProps } from './MediaItemGrid.tsx';

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

      useJellyfinLibraryItems(
        currentServer!.id,
        item.Id,
        childKind ? [childKind] : [],
        null,
        hasChildren && modalOpen,
      );

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
            serverName: currentServer!.name,
            childCount: extractChildCount(item),
            id: item.Id,
          };
        },
        [currentServer],
      );

      const metadata = useMemo(
        () => ({
          itemId: item.Id,
          isPlaylist: item.Type === 'Playlist',
          hasThumbnail: isNonEmptyString((item.ImageTags ?? {})['Primary']),
          childCount: extractChildCount(item),
          isMusicItem: isMusicItem(item),
          isEpisode: isEpisode(item),
          title: item.Name ?? '',
          subtitle: subtitle(item),
          thumbnailUrl: thumbnailUrlFunc(item),
          selectedMedia: selectedMediaFunc(item),
        }),
        [isEpisode, isMusicItem, item, selectedMediaFunc, thumbnailUrlFunc],
      );

      return (
        currentServer && (
          <MediaGridItem
            {...props}
            key={props.item.Id}
            itemSource="jellyfin"
            ref={ref}
            metadata={metadata}
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
