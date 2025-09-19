import { useSettings } from '@/store/settings/selectors.ts';
import { createExternalId } from '@tunarr/shared';
import type { Library, ProgramOrFolder } from '@tunarr/types';
import { getChildItemType, tag } from '@tunarr/types';
import { isEqual } from 'lodash-es';
import pluralize from 'pluralize';
import type { JSX } from 'react';
import {
  forwardRef,
  memo,
  useCallback,
  useMemo,
  type ForwardedRef,
} from 'react';
import { match, P } from 'ts-pattern';
import { isNonEmptyString, prettyItemDuration } from '../../helpers/util.ts';
import { useCurrentMediaSource } from '../../store/programmingSelector/selectors.ts';
import type { GridItemMetadata } from '../channel_config/MediaGridItem.tsx';
import { MediaGridItem } from '../channel_config/MediaGridItem.tsx';
import type { GridItemProps } from '../channel_config/MediaItemGrid.tsx';

export function isTerminalItemType(program: ProgramOrFolder | Library) {
  return (
    program.type === 'movie' ||
    program.type === 'music_video' ||
    program.type === 'episode' ||
    program.type === 'track' ||
    program.type === 'other_video'
  );
}

export const extractSubtitle = (program: ProgramOrFolder) =>
  match(program)
    .returnType<JSX.Element | null>()
    .with(
      {
        type: P.union(
          'movie',
          'episode',
          'track',
          'music_video',
          'other_video',
        ),
      },
      (terminal) => <span>{prettyItemDuration(terminal.duration)}</span>,
    )
    .with({ childCount: P.nullish }, () => null)
    .with({ childCount: P.select() }, (childCount, grouping) => {
      return (
        <span>{`${childCount} ${pluralize(
          getChildItemType(grouping.type),
          childCount,
        )}`}</span>
      );
    })
    .otherwise((v) => {
      console.warn(v);
      return null;
    });

export const ProgramGridItem = memo(
  forwardRef(
    <T extends ProgramOrFolder>(
      props: GridItemProps<T>,
      ref: ForwardedRef<HTMLDivElement>,
    ) => {
      const {
        item,
        index,
        moveModal,
        disableSelection,
        persisted = false,
      } = props;
      const settings = useSettings();
      const currentServer = useCurrentMediaSource();

      const isMusicItem = useCallback(
        (item: ProgramOrFolder) =>
          ['artist', 'album', 'track'].includes(item.type),
        [],
      );

      const isEpisode = useCallback(
        (item: ProgramOrFolder) => item.type === 'episode',
        [],
      );

      const moveModalToItem = useCallback(() => {
        moveModal(index, item);
      }, [index, item, moveModal]);

      const handleItemClick = useCallback(() => {
        moveModalToItem();
      }, [moveModalToItem]);

      const thumbnailUrlFunc = useCallback(
        (item: ProgramOrFolder) => {
          const idToUse = item.externalId;

          if (!idToUse) {
            return null;
          }

          const query = new URLSearchParams({
            mode: 'proxy',
            asset: 'image',
            id: createExternalId(
              item.sourceType,
              tag(item.mediaSourceId),
              idToUse,
            ),
            // Commenting this out for now as temporary solution for image loading issue
            // thumbOptions: JSON.stringify({ width: 480, height: 720 }),
            cache: import.meta.env.PROD ? 'true' : 'false',
          });

          return `${
            settings.backendUri
          }/api/metadata/external?${query.toString()}`;
        },
        [settings.backendUri],
      );

      const thumbnailUrl =
        item.type === 'folder' || item.type === 'playlist'
          ? ''
          : (thumbnailUrlFunc(item) ?? '');

      const metadata = useMemo(
        () =>
          ({
            itemId: item.uuid,
            hasThumbnail: isNonEmptyString(thumbnailUrl),
            childCount: null,
            mayHaveChildren: !isTerminalItemType(item),
            title: item.title,
            subtitle: extractSubtitle(item),
            thumbnailUrl,
            selectedMedia: {
              type: props.item.sourceType,
              id: item.uuid,
              mediaSource: currentServer!,
              libraryId: item.libraryId,
            },
            aspectRatio: isMusicItem(item)
              ? 'square'
              : isEpisode(item)
                ? 'landscape'
                : 'portrait',
            isPlaylist: false,
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
          thumbnailUrl,
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
    },
  ),
  isEqual,
);
