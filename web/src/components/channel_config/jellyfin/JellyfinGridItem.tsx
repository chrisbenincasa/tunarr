import { isEqual, isNil } from 'lodash-es';
import {
  type ForwardedRef,
  forwardRef,
  memo,
  useCallback,
  useMemo,
} from 'react';
import {
  isNonEmptyString,
  pluralizeWithCount,
  prettyItemDuration,
} from '../../../helpers/util.ts';

import { addJellyfinSelectedMedia } from '@/store/programmingSelector/actions.ts';
import { useCurrentMediaSource } from '@/store/programmingSelector/selectors.ts';
import { type SelectedMedia } from '@/store/programmingSelector/store.ts';
import { type JellyfinItem } from '@tunarr/types/jellyfin';
import { match, P } from 'ts-pattern';
import { type GridItemMetadata, MediaGridItem } from '../MediaGridItem.tsx';
import { type GridItemProps } from '../MediaItemGrid.tsx';

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

function landscapeAspectRatioJellyfinItem(item: JellyfinItem) {
  switch (item.Type) {
    case 'Video':
    case 'AggregateFolder':
    case 'CollectionFolder':
    case 'Episode':
    case 'Folder':
    case 'Genre':
    case 'ManualPlaylistsFolder':
    case 'MusicVideo':
    case 'PlaylistsFolder':
    case 'Trailer':
    case 'UserRootFolder':
    case 'UserView':
      return true;
    default:
      return false;
  }
}

function isJellyfinFolder(item: JellyfinItem) {
  switch (item.Type) {
    case 'AggregateFolder':
    case 'CollectionFolder':
    case 'Folder':
    case 'ManualPlaylistsFolder':
    case 'PlaylistsFolder':
    case 'UserRootFolder':
      return true;
    default:
      return false;
  }
}

function subtitle(item: JellyfinItem) {
  return match(item)
    .with(
      { Type: P.union('Movie', 'Video', 'MusicVideo', 'Episode', 'Audio') },
      () => {
        const year =
          !isNil(item.ProductionYear) &&
          item.Type !== 'Episode' &&
          item.Type !== 'Audio'
            ? ` (${item.ProductionYear})`
            : '';
        return (
          <span>
            {prettyItemDuration((item.RunTimeTicks ?? 0) / 10_000)}
            {year}
          </span>
        );
      },
    )
    .otherwise(() => {
      const childCount = extractChildCount(item);
      if (isNil(childCount)) {
        return null;
      }

      const pluralString = pluralizeWithCount(
        childItemType(item) ?? 'item',
        childCount,
      );

      const year = !isNil(item.ProductionYear)
        ? ` (${item.ProductionYear})`
        : '';

      return (
        <span>
          {pluralString}
          {year}
        </span>
      );
    });
}

export const JellyfinGridItem = memo(
  forwardRef(
    (props: JellyfinGridItemProps, ref: ForwardedRef<HTMLDivElement>) => {
      const { item, index, moveModal } = props;
      const currentServer = useCurrentMediaSource('jellyfin');

      const isMusicItem = useCallback(
        (item: JellyfinItem) =>
          ['MusicArtist', 'MusicAlbum', 'Audio'].includes(item.Type),
        [],
      );

      const moveModalToItem = useCallback(() => {
        moveModal(index, item);
      }, [index, item, moveModal]);

      const handleItemClick = useCallback(() => {
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
              : landscapeAspectRatioJellyfinItem(item)
                ? 'landscape'
                : 'portrait',
            subtitle: subtitle(item),
            thumbnailUrl: thumbnailUrlFunc(item),
            selectedMedia: selectedMediaFunc(item),
            isFolder: isJellyfinFolder(item),
          }) satisfies GridItemMetadata,
        [isMusicItem, item, selectedMediaFunc, thumbnailUrlFunc],
      );

      const onSelect = useCallback(
        (item: JellyfinItem) => addJellyfinSelectedMedia(currentServer!, item),
        [currentServer],
      );

      return (
        <MediaGridItem
          {...props}
          key={props.item.Id}
          itemSource="jellyfin"
          ref={ref}
          metadata={metadata}
          onClick={handleItemClick}
          onSelect={onSelect}
        />
      );
    },
  ),
  (prev, next) => {
    if (!isEqual(prev, next)) {
      // console.log(prev, next);
    }
    return isEqual(prev, next);
  },
);
