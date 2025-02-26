import {
  isPlexPlaylist,
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
  forPlexMedia,
  isNonEmptyString,
  prettyItemDuration,
  toggle,
} from '../../helpers/util.ts';

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
import { MediaGridItem, type GridItemMetadata } from './MediaGridItem.tsx';
import type { GridItemProps } from './MediaItemGrid.tsx';

const genPlexChildPath = forPlexMedia({
  collection: (collection) =>
    `/library/collections/${collection.ratingKey}/children`,
  playlist: (playlist) => `/playlists/${playlist.ratingKey}/items`,
  default: (item) => `/library/metadata/${item.ratingKey}/children`,
});

const extractChildCount = forPlexMedia({
  season: (s) => s.leafCount,
  show: (s) => s.childCount,
  collection: (s) => parseInt(s.childCount),
  playlist: (s) => s.leafCount,
  default: 0,
});

const subtitle = forPlexMedia({
  movie: (item) => <span>{prettyItemDuration(item.duration ?? 0)}</span>,
  default: (item) => {
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
  },
});

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
      const currentServer = useCurrentMediaSource('plex');

      const isMusicItem = useCallback(
        (item: PlexMedia) => ['artist', 'album', 'track'].includes(item.type),
        [],
      );

      const isEpisode = useCallback(
        (item: PlexMedia) => item.type === 'episode',
        [],
      );

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
          isNonEmptyString(currentServer?.id)
        ) {
          addKnownMediaForPlexServer(
            currentServer.id,
            childItems.Metadata,
            item.guid,
          );
        }
      }, [childItems, currentServer?.id, item.guid]);

      const moveModalToItem = useCallback(() => {
        moveModal(index, item);
      }, [index, item, moveModal]);

      const handleItemClick = useCallback(() => {
        setModalOpen(toggle);
        moveModalToItem();
      }, [moveModalToItem]);

      const getRatingKey = (item: PlexMedia) => {
        if (item.type === 'track') {
          return (
            item.parentRatingKey ?? item.grandparentRatingKey ?? item.ratingKey
          );
        } else if (item.type === 'season') {
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
            serverId: currentServer!.id,
            serverName: currentServer!.name,
            childCount: extractChildCount(item) ?? 0,
            id: item.guid,
          };
        },
        [currentServer],
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
              isMusicItem(item) || isPlexPlaylist(item)
                ? 'square'
                : isEpisode(item)
                  ? 'landscape'
                  : 'portrait',
            isPlaylist: isPlexPlaylist(item),
          }) satisfies GridItemMetadata,
        [isEpisode, isMusicItem, item, selectedMediaFunc, thumbnailUrlFunc],
      );
      console.log(item);

      return (
        currentServer && (
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
