import { isEqual, isNil } from 'lodash-es';
import pluralize from 'pluralize';
import {
  type ForwardedRef,
  forwardRef,
  memo,
  useCallback,
  useMemo,
  useState,
} from 'react';
import {
  isNonEmptyString,
  prettyItemDuration,
  toggle,
} from '../../helpers/util.ts';

import { useJellyfinLibraryItems } from '@/hooks/jellyfin/useJellyfinApi.ts';
import { addJellyfinSelectedMedia } from '@/store/programmingSelector/actions.ts';
import { useCurrentMediaSource } from '@/store/programmingSelector/selectors.ts';
import { type SelectedMedia } from '@/store/programmingSelector/store.ts';
import type { JellyfinItemKind } from '@tunarr/types/jellyfin';
import { type JellyfinItem } from '@tunarr/types/jellyfin';
import { match, P } from 'ts-pattern';
import { type GridItemMetadata, MediaGridItem } from './MediaGridItem.tsx';
import { type GridItemProps } from './MediaItemGrid.tsx';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface JellyfinGridItemProps extends GridItemProps<JellyfinItem> {}

function extractChildCount(jfItem: JellyfinItem) {
  return match(jfItem)
    .with(
      {
        Type: P.union(
          'Season',
          'Series',
          'MusicAlbum',
          'MusicArtist',
          'CollectionFolder',
          'Playlist',
          'Folder',
        ),
      },
      (s) => s.ChildCount ?? null,
    )
    .otherwise(() => 0);
}

function childItemType(item: JellyfinItem) {
  return match(item)
    .with({ Type: 'Season' }, () => 'episode')
    .with({ Type: 'Series' }, () => 'season')
    .with({ Type: 'CollectionFolder' }, () => 'item')
    .with({ Type: 'Playlist' }, (pl) =>
      pl.MediaType === 'Audio' ? 'track' : 'video',
    )
    .with({ Type: 'MusicArtist' }, () => 'album')
    .with({ Type: 'MusicAlbum' }, () => 'track')
    .otherwise(() => null);
}

function childJellyfinType(item: JellyfinItem) {
  return match(item)
    .returnType<JellyfinItemKind | null>()
    .with({ Type: 'Season' }, () => 'Episode')
    .with({ Type: 'Series' }, () => 'Season')
    .with({ Type: 'MusicAlbum' }, () => 'Audio')
    .with({ Type: 'MusicArtist' }, () => 'MusicAlbum')
    .otherwise(() => null);
}

function subtitle(item: JellyfinItem) {
  return match(item)
    .with({ Type: 'Movie' }, () => (
      <span>{prettyItemDuration((item.RunTimeTicks ?? 0) / 10_000)}</span>
    ))
    .otherwise(() => {
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
    });
}

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
            childCount: extractChildCount(item) ?? undefined,
            id: item.Id,
          };
        },
        [currentServer],
      );

      const metadata = useMemo(
        () =>
          ({
            itemId: item.Id,
            isPlaylist: item.Type === 'Playlist',
            hasThumbnail: isNonEmptyString((item.ImageTags ?? {})['Primary']),
            childCount: extractChildCount(item),
            title: item.Name ?? '',
            aspectRatio: isMusicItem(item)
              ? 'square'
              : isEpisode(item)
                ? 'landscape'
                : 'portrait',
            subtitle: subtitle(item),
            thumbnailUrl: thumbnailUrlFunc(item),
            selectedMedia: selectedMediaFunc(item),
          }) satisfies GridItemMetadata,
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
