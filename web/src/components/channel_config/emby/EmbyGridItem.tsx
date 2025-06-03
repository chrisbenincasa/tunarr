import { isEmpty, isEqual, isNil } from 'lodash-es';
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
} from '../../../helpers/util.ts';

import { addEmbySelectedMedia } from '@/store/programmingSelector/actions.ts';
import { useCurrentMediaSource } from '@/store/programmingSelector/selectors.ts';
import { type SelectedMedia } from '@/store/programmingSelector/store.ts';
import { type EmbyItem } from '@tunarr/types/emby';
import { match, P } from 'ts-pattern';
import { Emby } from '../../../helpers/constants.ts';
import {
  childEmbyItemKind,
  childEmbyItemType,
} from '../../../helpers/embyUtil.ts';
import { useEmbyLibraryItems } from '../../../hooks/emby/useEmbyApi.ts';
import { type GridItemMetadata, MediaGridItem } from '../MediaGridItem.tsx';
import { type GridItemProps } from '../MediaItemGrid.tsx';

const subtitle = (item: EmbyItem) => {
  return match(item)
    .with(
      { Type: P.union('Movie', 'Video', 'Episode', 'MusicVideo', 'Audio') },
      (item) => (
        <span>{prettyItemDuration((item.RunTimeTicks ?? 0) / 10_000)}</span>
      ),
    )
    .otherwise((item) => {
      const childCount = item.ChildCount ?? 0;
      if (isNil(childCount)) {
        return null;
      }

      return (
        <span>{`${childCount} ${pluralize(
          childEmbyItemType(item) ?? 'item',
          childCount,
        )}`}</span>
      );
    });
};

export const EmbyGridItem = memo(
  forwardRef(
    (props: GridItemProps<EmbyItem>, ref: ForwardedRef<HTMLDivElement>) => {
      const { item, index, moveModal } = props;
      const [modalOpen, setModalOpen] = useState(false);
      const currentServer = useCurrentMediaSource(Emby);

      const isMusicItem = useCallback(
        (item: EmbyItem) =>
          item.Type &&
          ['MusicArtist', 'MusicAlbum', 'Audio'].includes(item.Type),
        [],
      );

      const isEpisode = useCallback(
        (item: EmbyItem) => item.Type === 'Episode',
        [],
      );

      const hasChildren = item.Type && ['Series', 'Season'].includes(item.Type);
      const childKind = childEmbyItemKind(item);

      useEmbyLibraryItems(
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

      const selectedMediaFunc = useCallback(
        (item: EmbyItem): SelectedMedia => {
          return {
            type: Emby,
            serverId: currentServer!.id,
            serverName: currentServer!.name,
            childCount: item.ChildCount ?? 0,
            id: item.Id,
          };
        },
        [currentServer],
      );

      const metadata = useMemo(() => {
        let imageId = item.Id;
        let imageTag = item.ImageTags?.['Primary'];
        if (isEmpty(imageTag) && item) {
          imageTag = item.ParentThumbImageTag ?? item.SeriesPrimaryImageTag;
          imageId = item.ParentId ?? item.SeriesId ?? item.Id;
        }
        const thumbnailUrl = `${currentServer?.uri}/Items/${
          imageId
        }/Images/Primary?fillHeight=300&fillWidth=200&quality=96&tag=${
          imageTag
        }`;

        return {
          itemId: item.Id,
          isPlaylist: item.Type === 'Playlist',
          hasThumbnail: isNonEmptyString(imageTag),
          childCount: item.ChildCount ?? 0,
          title: item.Name ?? '',
          aspectRatio: isMusicItem(item)
            ? 'square'
            : isEpisode(item)
              ? 'landscape'
              : 'portrait',
          subtitle: subtitle(item),
          thumbnailUrl,
          selectedMedia: selectedMediaFunc(item),
        } satisfies GridItemMetadata;
      }, [currentServer?.uri, isEpisode, isMusicItem, item, selectedMediaFunc]);

      return (
        currentServer && (
          <MediaGridItem
            {...props}
            key={props.item.Id}
            itemSource={Emby}
            ref={ref}
            metadata={metadata}
            onClick={handleItemClick}
            onSelect={(item) => addEmbySelectedMedia(currentServer, item)}
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
