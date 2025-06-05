import {
  isPlexEpisode,
  isPlexMusicTrack,
  isPlexPlaylist,
  isPlexSeason,
  isTerminalItem,
  type PlexChildListing,
  type PlexMedia,
} from '@tunarr/types/plex';
import { isEmpty, isEqual, isNil, isUndefined } from 'lodash-es';
import pluralize from 'pluralize';
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ForwardedRef,
} from 'react';
import {
  isNonEmptyString,
  prettyItemDuration,
  toggle,
} from '../../../helpers/util.ts';

import { getPlexMediaChildType } from '@/helpers/plexUtil.ts';
import { usePlexTyped } from '@/hooks/plex/usePlex.ts';
import {
  addKnownMediaForPlexServer,
  addPlexSelectedMedia,
} from '@/store/programmingSelector/actions.ts';
import { useCurrentMediaSource } from '@/store/programmingSelector/selectors.ts';
import type { SelectedMedia } from '@/store/programmingSelector/store.ts';
import { useSettings } from '@/store/settings/selectors.ts';
import { createExternalId } from '@tunarr/shared';
import { match, P } from 'ts-pattern';
import { MediaGridItem, type GridItemMetadata } from '../MediaGridItem.tsx';
import type { GridItemProps } from '../MediaItemGrid.tsx';

function genPlexChildPath(media: PlexMedia) {
  return match(media)
    .with(
      { type: 'collection' },
      (collection) => `/library/collections/${collection.ratingKey}/children`,
    )
    .with(
      { type: 'playlist' },
      (playlist) => `/playlists/${playlist.ratingKey}/items`,
    )
    .otherwise((item) => `/library/metadata/${item.ratingKey}/children`);
}

function extractChildCount(media: PlexMedia) {
  return match(media)
    .with({ type: P.union('season', 'playlist') }, (s) => s.leafCount ?? 0)
    .with({ type: P.union('show') }, (s) => s.childCount)
    .with({ type: 'collection' }, (c) => parseInt(c.childCount))
    .otherwise(() => 0);
}

function subtitle(media: PlexMedia) {
  return match(media)
    .with({ type: P.union('movie', 'episode') }, (m) => (
      <span>{prettyItemDuration(m.duration ?? 0)}</span>
    ))
    .otherwise((item) => {
      const childCount = extractChildCount(item);
      if (isNil(childCount)) {
        return null;
      }

      return (
        <span>{`${childCount} ${pluralize(
          getPlexMediaChildType(item) ?? 'item',
          childCount,
        )}`}</span>
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
      const [modalOpen, setModalOpen] = useState(false);

      const onSelect = useCallback(
        (item: PlexMedia) => {
          addPlexSelectedMedia(server, [item]);
        },
        [server],
      );

      const { data: childItems } = usePlexTyped<PlexChildListing>(
        server.id,
        genPlexChildPath(props.item),
        !isTerminalItem(item) && modalOpen,
      );

      useEffect(() => {
        if (
          !isUndefined(childItems) &&
          !isEmpty(childItems.Metadata) &&
          isNonEmptyString(server?.id)
        ) {
          addKnownMediaForPlexServer(server.id, childItems.Metadata, item.guid);
        }
      }, [childItems, server?.id, item.guid]);

      const moveModalToItem = useCallback(() => {
        moveModal(index, item);
      }, [index, item, moveModal]);

      const handleItemClick = useCallback(() => {
        setModalOpen(toggle);
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
            itemSource="plex"
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
