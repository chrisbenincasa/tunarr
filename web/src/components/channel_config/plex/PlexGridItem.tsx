import {
  isPlexEpisode,
  isPlexMusicTrack,
  isPlexPlaylist,
  isPlexSeason,
  type PlexMedia,
} from '@tunarr/types/plex';
import { isEqual, isNil } from 'lodash-es';
import {
  forwardRef,
  memo,
  useCallback,
  useMemo,
  type ForwardedRef,
} from 'react';
import {
  isNonEmptyString,
  pluralizeWithCount,
  prettyItemDuration,
} from '../../../helpers/util.ts';

import { getPlexMediaChildType } from '@/helpers/plexUtil.ts';
import { addPlexSelectedMedia } from '@/store/programmingSelector/actions.ts';
import { useCurrentMediaSource } from '@/store/programmingSelector/selectors.ts';
import type { SelectedMedia } from '@/store/programmingSelector/store.ts';
import { useSettings } from '@/store/settings/selectors.ts';
import { createExternalId } from '@tunarr/shared';
import { match, P } from 'ts-pattern';
import { Plex } from '../../../helpers/constants.ts';
import { MediaGridItem, type GridItemMetadata } from '../MediaGridItem.tsx';
import type { GridItemProps } from '../MediaItemGrid.tsx';

function extractChildCount(media: PlexMedia) {
  return match(media)
    .with({ type: P.union('season', 'playlist') }, (s) => s.leafCount ?? 0)
    .with({ type: P.union('show') }, (s) => s.childCount)
    .with({ type: 'collection' }, (c) => parseInt(c.childCount))
    .otherwise(() => 0);
}

function subtitle(media: PlexMedia) {
  return match(media)
    .with({ type: P.union('movie', 'episode') }, (m) => {
      const year = media.type === 'movie' ? ` (${media.year})` : '';
      return (
        <span>
          {prettyItemDuration(m.duration ?? 0)}
          {year}
        </span>
      );
    })
    .otherwise((item) => {
      const childCount = extractChildCount(item);
      const year = match(item)
        .with({ type: 'album' }, (album) => album.year)
        .with({ type: 'show' }, (show) => show.year)
        .otherwise(() => null);

      if (isNil(childCount) && isNil(year)) {
        return null;
      }

      const countStr = pluralizeWithCount(
        getPlexMediaChildType(item) ?? 'item',
        childCount,
      );
      const yearStr = isNil(year) ? null : ` (${year})`;

      return (
        <span>
          {countStr}
          {yearStr}
        </span>
      );
    });
}

function isPlexMusicItem(item: PlexMedia) {
  return ['artist', 'album', 'track'].includes(item.type);
}

export const PlexGridItem = memo(
  forwardRef(
    <T extends PlexMedia>(
      props: GridItemProps<T>,
      ref: ForwardedRef<HTMLDivElement>,
    ) => {
      const { item, index, moveModal } = props;
      const server = useCurrentMediaSource('plex')!; // We have to have a server at this point
      const settings = useSettings();

      const onSelect = useCallback(
        (item: PlexMedia) => {
          addPlexSelectedMedia(server, [item]);
        },
        [server],
      );

      const moveModalToItem = useCallback(() => {
        moveModal(index, item);
      }, [index, item, moveModal]);

      const handleItemClick = useCallback(() => {
        moveModalToItem();
      }, [moveModalToItem]);

      const getRatingKey = (item: PlexMedia) => {
        if (isPlexMusicTrack(item)) {
          return (
            item.parentRatingKey ?? item.grandparentRatingKey ?? item.ratingKey
          );
        } else if (isPlexSeason(item)) {
          return item.thumb === item.parentThumb && item.parentRatingKey
            ? item.parentRatingKey
            : item.ratingKey;
        } else {
          return item.ratingKey;
        }
      };

      const thumbnailUrlFunc = useCallback(
        (item: PlexMedia) => {
          if (isPlexPlaylist(item)) {
            return `${server.uri}${item.composite}?X-Plex-Token=${server.accessToken}`;
          } else {
            const query = new URLSearchParams({
              mode: 'proxy',
              asset: 'thumb',
              id: createExternalId('plex', server.name, getRatingKey(item)),
              // Commenting this out for now as temporary solution for image loading issue
              // thumbOptions: JSON.stringify({ width: 480, height: 720 }),
              cache: import.meta.env.PROD ? 'true' : 'false',
            });

            return `${
              settings.backendUri
            }/api/metadata/external?${query.toString()}`;
          }
        },
        [server.accessToken, server.name, server.uri, settings.backendUri],
      );

      const selectedMediaFunc = useCallback(
        (item: PlexMedia): SelectedMedia => {
          return {
            type: 'plex',
            serverId: server.id,
            serverName: server.name,
            childCount: extractChildCount(item) ?? 0,
            id: item.guid,
          };
        },
        [server],
      );

      const metadata = useMemo(
        () =>
          ({
            itemId: item.guid,
            hasThumbnail: isNonEmptyString(
              isPlexPlaylist(item)
                ? item.composite
                : item.type === 'track'
                  ? (item.parentThumb ?? item.grandparentThumb ?? item.thumb)
                  : item.thumb,
            ),
            childCount: extractChildCount(item),
            title: item.title,
            subtitle: subtitle(item),
            thumbnailUrl: thumbnailUrlFunc(item),
            selectedMedia: selectedMediaFunc(item),
            aspectRatio:
              isPlexMusicItem(item) || isPlexPlaylist(item)
                ? 'square'
                : isPlexEpisode(item)
                  ? 'landscape'
                  : 'portrait',
            isPlaylist: isPlexPlaylist(item),
          }) satisfies GridItemMetadata,
        [item, selectedMediaFunc, thumbnailUrlFunc],
      );

      return (
        server && (
          <MediaGridItem
            {...props}
            key={props.item.guid}
            itemSource={Plex}
            ref={ref}
            metadata={metadata}
            onClick={handleItemClick}
            onSelect={onSelect}
          />
        )
      );
    },
  ),
  isEqual,
);
