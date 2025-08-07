import { isEqual, isNull } from 'lodash-es';
import pluralize from 'pluralize';
import {
  forwardRef,
  memo,
  useCallback,
  useMemo,
  useState,
  type ForwardedRef,
} from 'react';
import { prettyItemDuration, toggle } from '../../helpers/util.ts';

import { useSettings } from '@/store/settings/selectors.ts';
import { createExternalId } from '@tunarr/shared';

import { getChildItemType, tag, type ProgramLike } from '@tunarr/types';
import { match, P } from 'ts-pattern';
import { Imported } from '../../helpers/constants.ts';
import { useApiQuery } from '../../hooks/useApiQuery.ts';
import { getChildSearchFilter } from '../../hooks/useProgramSearch.ts';
import type { ImportedLibrarySelectedMedia } from '../../store/programmingSelector/store.ts';
import type { GridItemMetadata } from '../channel_config/MediaGridItem.tsx';
import { MediaGridItem } from '../channel_config/MediaGridItem.tsx';
import type { GridItemProps } from '../channel_config/MediaItemGrid.tsx';

function isTerminalItemType(program: ProgramLike) {
  return (
    program.type === 'movie' ||
    program.type === 'music_video' ||
    program.type === 'episode' ||
    program.type === 'track' ||
    program.type === 'other_video'
  );
}

const extractSubtitle = (program: ProgramLike) =>
  match(program)
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
    .with({ type: P._, childCount: undefined }, () => null)
    .with({ type: P._, childCount: P.select() }, (childCount, grouping) => {
      return (
        <span>{`${childCount} ${pluralize(
          getChildItemType(grouping.type),
          childCount,
        )}`}</span>
      );
    })
    .exhaustive();

export const ProgramGridItem = memo(
  forwardRef(
    <T extends ProgramLike>(
      props: GridItemProps<T>,
      ref: ForwardedRef<HTMLDivElement>,
    ) => {
      const { item, index, moveModal, disableSelection } = props;
      // const server = useCurrentMediaSource('plex')!; // We have to have a server at this point
      const settings = useSettings();
      const [modalOpen, setModalOpen] = useState(false);
      // const currentServer = useCurrentMediaSource('plex');

      const isMusicItem = useCallback(
        (item: ProgramLike) => ['artist', 'album', 'track'].includes(item.type),
        [],
      );

      const isEpisode = useCallback(
        (item: ProgramLike) => item.type === 'episode',
        [],
      );

      const childrenFilter = useMemo(() => getChildSearchFilter(item), [item]);

      const search = useApiQuery({
        queryKey: ['programs', item.uuid, 'children'],
        enabled: modalOpen && !isNull(childrenFilter),
        queryFn: (apiClient) => {
          return apiClient.searchPrograms({
            libraryId: item.libraryId,
            query: {
              // query: searchRequest?.query,
              filter: childrenFilter,
            },
            // limit: 10,
            // page: pageParam,
          });
        },
        // getNextPageParam: (last) => {
        //   return last.page + 1;
        // },
        // getPreviousPageParam: (last) => last.page - 1,
        // initialPageParam: 1,
        staleTime: 0,
      });

      // useEffect(() => {
      //   if (
      //     !isUndefined(childItems) &&
      //     !isEmpty(childItems.Metadata) &&
      //     isNonEmptyString(currentServer?.id)
      //   ) {
      //     addKnownMediaForPlexServer(
      //       currentServer.id,
      //       childItems.Metadata,
      //       item.guid,
      //     );
      //   }
      // }, [childItems, currentServer?.id, item.guid]);

      const moveModalToItem = useCallback(() => {
        moveModal(index, item);
      }, [index, item, moveModal]);

      const handleItemClick = useCallback(() => {
        setModalOpen(toggle);
        moveModalToItem();
      }, [moveModalToItem]);

      const thumbnailUrlFunc = useCallback(
        (item: ProgramLike) => {
          // if (isPlexPlaylist(item)) {
          //   return `${server.uri}${item.composite}?X-Plex-Token=${server.accessToken}`;
          // } else {
          // }
          const idToUse = item.identifiers.find(
            (id) =>
              id.type === 'plex' ||
              id.type === 'emby' ||
              id.type === 'jellyfin',
          );

          if (!idToUse) {
            return null;
          }

          const query = new URLSearchParams({
            mode: 'proxy',
            asset: 'image',
            // imageType: 'poster',
            id: createExternalId(
              idToUse.type,
              idToUse.sourceId ?? '',
              idToUse.id,
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

      // const selectedMediaFunc = useCallback(
      //   (item: PlexMedia): SelectedMedia => {
      //     return {
      //       type: 'plex',
      //       serverId: currentServer!.id,
      //       serverName: currentServer!.name,
      //       childCount: extractChildCount(item) ?? 0,
      //       id: item.guid,
      //     };
      //   },
      //   [currentServer],
      // );

      const metadata = useMemo(
        () =>
          ({
            itemId: item.uuid,
            hasThumbnail: true,
            childCount: null,
            mayHaveChildren: !isTerminalItemType(item),
            title: item.title,
            subtitle: extractSubtitle(item),
            thumbnailUrl: thumbnailUrlFunc(item) ?? '',
            selectedMedia: {
              type: Imported,
              id: item.uuid,
              // TODO: Make this type official
              serverId: tag(item.mediaSourceId),
              serverName: item.mediaSourceId,
            } satisfies ImportedLibrarySelectedMedia,
            aspectRatio: isMusicItem(item)
              ? 'square'
              : isEpisode(item)
                ? 'landscape'
                : 'portrait',
            isPlaylist: false,
          }) satisfies GridItemMetadata,
        [isEpisode, isMusicItem, item, thumbnailUrlFunc],
      );

      return (
        <MediaGridItem
          {...props}
          key={props.item.uuid}
          itemSource={Imported}
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
