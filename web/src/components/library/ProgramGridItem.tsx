import { useNavigate } from '@tanstack/react-router';
import type { ProgramOrFolder } from '@tunarr/types';
import { isTerminalItemType } from '@tunarr/types';
import { forwardRef, useCallback, useMemo, type ForwardedRef } from 'react';
import { useGetArtworkUrl } from '../../hooks/useThumbnailUrl.ts';
import { useCurrentMediaSource } from '../../store/programmingSelector/selectors.ts';
import type { GridItemMetadata } from '../channel_config/MediaGridItem.tsx';
import { MediaGridItem } from '../channel_config/MediaGridItem.tsx';
import type { GridItemProps } from '../channel_config/MediaItemGrid.tsx';
import { ProgramSubtitle } from './extractSubtitle.tsx';

const ProgramGridItemInner = <T extends ProgramOrFolder>(
  props: GridItemProps<T>,
  ref: ForwardedRef<HTMLDivElement>,
) => {
  const { item, index, moveModal, disableSelection, persisted = false } = props;
  const currentServer = useCurrentMediaSource();
  const navigate = useNavigate();

  const isMusicItem = useCallback(
    (item: ProgramOrFolder) => ['artist', 'album', 'track'].includes(item.type),
    [],
  );

  const isEpisode = useCallback(
    (item: ProgramOrFolder) => item.type === 'episode',
    [],
  );

  const moveModalToItem = useCallback(() => {
    moveModal(index, item);
  }, [index, item, moveModal]);

  const handleItemClick = useCallback(async () => {
    if (disableSelection) {
      await navigate({
        to: `/media/${item.type}/${item.uuid}`,
        replace: false,
        resetScroll: true,
      });
    } else {
      moveModalToItem();
    }
  }, [disableSelection, moveModalToItem, item.type, item.uuid, navigate]);

  const thumbnailUrlFunc = useGetArtworkUrl();

  const metadata = useMemo(
    () =>
      ({
        itemId: item.uuid,
        itemType: item.type,
        childCount: null,
        mayHaveChildren: !isTerminalItemType(item),
        title: item.title,
        subtitle: ProgramSubtitle(item),
        thumbnailUrl: thumbnailUrlFunc(item),
        selectedMedia:
          props.item.sourceType === 'local'
            ? {
                type: props.item.sourceType,
                id: item.uuid,
                mediaSource: currentServer!,
                persisted: true,
              }
            : {
                type: props.item.sourceType,
                id: item.uuid,
                mediaSource: currentServer!,
                libraryId: item.libraryId,
                persisted: !!props.persisted,
              },
        aspectRatio: isMusicItem(item)
          ? 'square'
          : isEpisode(item)
            ? 'landscape'
            : 'portrait',
        isPlaylist: item.type === 'playlist',
        isFolder: item.type === 'folder',
        persisted,
      }) satisfies GridItemMetadata,
    [
      currentServer,
      isEpisode,
      isMusicItem,
      item,
      persisted,
      props.item.sourceType,
      props.persisted,
      thumbnailUrlFunc,
    ],
  );

  return (
    <MediaGridItem
      {...props}
      key={props.item.uuid}
      itemSource={props.item.sourceType}
      ref={ref}
      metadata={metadata}
      onClick={handleItemClick}
      onSelect={() => {}}
      enableSelection={!disableSelection}
    />
  );
};

type ProgramGridItemFactory = <ItemTypeT extends ProgramOrFolder>(
  props: GridItemProps<ItemTypeT> & { ref?: ForwardedRef<HTMLDivElement> },
) => JSX.Element;

export const ProgramGridItem = forwardRef(
  ProgramGridItemInner,
) as ProgramGridItemFactory;
