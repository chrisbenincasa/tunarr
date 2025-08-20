import { Box } from '@mui/material';
import { useInfiniteQuery } from '@tanstack/react-query';
import type {
  ContentProgramParent,
  MusicArtistContentProgram,
  TvShowContentProgram,
} from '@tunarr/types';
import { type ContentProgram } from '@tunarr/types';
import type { MultiExternalIdType } from '@tunarr/types/schemas';
import {
  isValidMultiExternalIdType,
  type ContentProgramType,
} from '@tunarr/types/schemas';
import { identity, isEmpty, last, sumBy } from 'lodash-es';
import { forwardRef, useCallback, useMemo, type ForwardedRef } from 'react';
import {
  getApiChannelsByIdArtists,
  getApiChannelsByIdPrograms,
  getApiChannelsByIdShows,
  getApiProgramsByIdChildren,
} from '../../generated/sdk.gen.ts';
import { isNonEmptyString, prettyItemDuration } from '../../helpers/util.ts';
import { useSettings } from '../../store/settings/selectors.ts';
import type { GridItemMetadata } from '../channel_config/MediaGridItem.tsx';
import { MediaGridItem } from '../channel_config/MediaGridItem.tsx';
import type { GridItemProps } from '../channel_config/MediaItemGrid.tsx';
import { MediaItemGrid } from '../channel_config/MediaItemGrid.tsx';

type AllProgramTypes = ContentProgramType | ContentProgramParent['type'];

type Props = {
  channelId: string;
  programType: AllProgramTypes;
  parentId?: string;
  depth?: number;
};

const ProgramTypeToChildType: Partial<
  Record<AllProgramTypes, AllProgramTypes>
> = {
  show: 'season',
  season: 'episode',
  album: 'track',
  artist: 'album',
};

const GridItemImpl = forwardRef(
  (
    { item: program, index, depth }: GridItemProps<ContentProgram>,
    ref: ForwardedRef<HTMLDivElement>,
  ) => {
    const { backendUri } = useSettings();
    const metadata = useMemo(() => {
      const year =
        program.year ??
        (program.date ? new Date(program.date).getFullYear() : null);
      return {
        aspectRatio:
          program.subtype === 'track'
            ? 'square'
            : program.subtype === 'music_video' || program.subtype === 'episode'
              ? 'landscape'
              : 'portrait',
        childCount: null,
        hasThumbnail: true,
        isPlaylist: false,
        itemId: program.id!,
        subtitle: `${prettyItemDuration(program.duration)}${year ? ` (${year})` : ''}`,
        thumbnailUrl: `${backendUri}/api/programs/${program.id}/thumb`,
        title: program.title,
      } satisfies GridItemMetadata;
    }, [
      backendUri,
      program.date,
      program.duration,
      program.id,
      program.subtype,
      program.title,
      program.year,
    ]);

    return (
      <MediaGridItem
        ref={ref}
        key={program.id}
        depth={depth}
        index={index}
        isModalOpen={false}
        item={program}
        itemSource={program.externalSourceType}
        metadata={metadata}
        enableSelection={false}
        onClick={() => {}}
        onSelect={() => {}}
        disablePadding
      />
    );
  },
);

const ParentGridItemImpl = forwardRef(
  (
    {
      item: program,
      index,
      moveModal,
      depth,
    }: GridItemProps<ContentProgramParent>,
    ref: ForwardedRef<HTMLDivElement>,
  ) => {
    const { backendUri } = useSettings();
    const metadata = useMemo(() => {
      const year = program.year;
      return {
        aspectRatio:
          program.type === 'artist' || program.type === 'album'
            ? 'square'
            : 'portrait',
        childCount: 1,
        hasThumbnail: true,
        isPlaylist: false,
        itemId: program.id!,
        subtitle: year ? (program.year?.toString() ?? null) : null,
        thumbnailUrl: `${backendUri}/api/programs/${program.id}/thumb`,
        title: program.title ?? '',
      } satisfies GridItemMetadata;
    }, [backendUri, program.id, program.title, program.type, program.year]);

    const externalSourceType = useMemo(
      () =>
        program.externalIds.find((eid) =>
          eid.type === 'multi' &&
          isValidMultiExternalIdType(eid.source) &&
          isNonEmptyString(eid.sourceId)
            ? true
            : false,
        )?.source ?? 'plex',
      [program.externalIds],
    ) as MultiExternalIdType;

    const handleClick = useCallback(() => {
      moveModal(index, program);
    }, [index, moveModal, program]);

    return (
      <MediaGridItem
        ref={ref}
        key={program.id}
        depth={depth}
        index={index}
        isModalOpen={false}
        item={program}
        itemSource={externalSourceType}
        metadata={metadata}
        enableSelection={false}
        onClick={handleClick}
        onSelect={() => {}}
        disablePadding
      />
    );
  },
);

function isParentType(type: ContentProgramType | ContentProgramParent['type']) {
  switch (type) {
    case 'movie':
    case 'episode':
    case 'track':
    case 'music_video':
    case 'other_video':
      return false;
    case 'season':
    case 'show':
    case 'album':
    case 'artist':
      return true;
  }
}

type GridType = 'terminal' | 'parent' | 'nested';

export const ChannelProgramGrid = ({
  channelId,
  programType,
  depth = 0,
  parentId,
}: Props) => {
  const hasProgramHierarchy =
    programType === 'episode' || programType === 'track';

  const gridType = useMemo<GridType>(() => {
    if (!hasProgramHierarchy && !isParentType(programType) && !parentId) {
      return 'terminal';
    } else if (isNonEmptyString(parentId)) {
      return 'nested';
    } else {
      return 'parent';
    }
  }, [hasProgramHierarchy, parentId, programType]);

  const terminalQuery = useInfiniteQuery({
    queryKey: ['channels', channelId, 'programs', programType, 'infinite'],
    queryFn: ({ pageParam }) =>
      getApiChannelsByIdPrograms({
        path: { id: channelId },
        query: {
          type: programType as ContentProgramType,
          offset: pageParam,
          limit: 50,
        },
        throwOnError: true,
      }).then(({ data }) => data),
    getNextPageParam: (pages, x) => {
      if (pages.length > 0 && isEmpty(last(pages))) {
        return null;
      }

      const totalSize = sumBy(x, (x) => x.length);
      return totalSize;
    },
    initialPageParam: 0,
    // These are terminal types
    enabled: gridType === 'terminal',
  });

  const nestedQuery = useInfiniteQuery({
    queryKey: ['channels', channelId, 'programs', programType, 'infinite'],
    queryFn: async ({
      pageParam,
    }): Promise<{
      total: number;
      result: Array<TvShowContentProgram> | Array<MusicArtistContentProgram>;
    }> => {
      const prom = await (programType === 'show'
        ? getApiChannelsByIdShows({
            path: { id: channelId },
            query: { offset: pageParam, limit: 50 },
            throwOnError: true,
          })
        : getApiChannelsByIdArtists({
            path: { id: channelId },
            query: { offset: pageParam, limit: 50 },
            throwOnError: true,
          }));
      return prom.data;
    },
    getNextPageParam: (currentPage, pages) => {
      if ((currentPage.result?.length ?? 0) === 0) {
        return null;
      }

      const totalSize = sumBy(pages, (page) => page.result.length);
      return totalSize;
    },
    initialPageParam: 0,
    // These are terminal types
    enabled: gridType === 'parent',
  });

  const childrenQuery = useInfiniteQuery({
    queryKey: [
      'channels',
      channelId,
      'programs',
      programType,
      'infinite',
      parentId,
    ],
    queryFn: ({ pageParam }) =>
      getApiProgramsByIdChildren({
        path: { id: parentId ?? '' },
        query: {
          offset: pageParam,
          limit: 50,
          channelId,
        },
        throwOnError: true,
      }).then(({ data }) => data),
    getNextPageParam: (currentPage, allPages) => {
      if (currentPage.result.programs.length < 50) {
        return null;
      }

      const totalSize = sumBy(allPages, (page) => page.result.programs.length);
      return totalSize;
    },
    initialPageParam: 0,
    // These are terminal types
    enabled: gridType === 'nested',
  });

  const renderContentProgramGridItem = useCallback(
    (props: GridItemProps<ContentProgram>) => <GridItemImpl {...props} />,
    [],
  );

  const renderParentProgramGridItem = useCallback(
    (props: GridItemProps<ContentProgramParent>) => (
      <ParentGridItemImpl {...props} />
    ),
    [],
  );

  const renderParentOrChild = useCallback(
    (props: GridItemProps<ContentProgram | ContentProgramParent>) => {
      switch (props.item.type) {
        case 'season':
        case 'album':
        case 'show':
        case 'artist':
          return renderParentProgramGridItem({ ...props, item: props.item });
        case 'content':
          return renderContentProgramGridItem({ ...props, item: props.item });
      }
    },
    [renderContentProgramGridItem, renderParentProgramGridItem],
  );

  return (
    <Box
      sx={{
        height: depth === 0 ? '100vh' : undefined,
        mt: depth > 0 ? 1 : 0,
        px: depth === 0 ? 0 : 2,
      }}
    >
      {gridType === 'parent' ? (
        <MediaItemGrid
          infiniteQuery={nestedQuery}
          getPageDataSize={(page) => ({
            size: page.result.length,
            total: page.total,
          })}
          extractItems={(page) => page.result}
          renderNestedGrid={(props) => (
            <ChannelProgramGrid
              channelId={channelId}
              depth={props.depth}
              programType={ProgramTypeToChildType[programType]!}
              parentId={props.parent?.id}
            />
          )}
          renderGridItem={renderParentProgramGridItem}
          getItemKey={(p) => p.id!}
          depth={depth}
        />
      ) : gridType === 'nested' ? (
        <MediaItemGrid
          infiniteQuery={childrenQuery}
          getPageDataSize={(page) => ({
            size: page.result.programs.length,
            total: page.total,
          })}
          extractItems={(page) => page.result.programs}
          renderNestedGrid={(props) => (
            <ChannelProgramGrid
              channelId={channelId}
              depth={props.depth}
              programType={ProgramTypeToChildType[programType]!}
              parentId={props.parent?.id}
            />
          )}
          renderGridItem={renderParentOrChild}
          getItemKey={(p) => p.id!}
          depth={depth}
        />
      ) : (
        <MediaItemGrid
          infiniteQuery={terminalQuery}
          getPageDataSize={(page) => ({ size: page.length })}
          extractItems={identity}
          renderNestedGrid={() => null}
          renderGridItem={renderContentProgramGridItem}
          getItemKey={(p) => p.id!}
          depth={depth}
        />
      )}
    </Box>
  );
};
