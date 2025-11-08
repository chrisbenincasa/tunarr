import { Box } from '@mui/material';
import { useInfiniteQuery } from '@tanstack/react-query';
import type {
  ContentProgramParent,
  MusicArtist,
  ProgramOrFolder,
  Show,
} from '@tunarr/types';
import { type ContentProgramType } from '@tunarr/types/schemas';
import { identity, isEmpty, last, sumBy } from 'lodash-es';
import { useCallback, useMemo } from 'react';
import {
  getApiChannelsByIdArtists,
  getApiChannelsByIdPrograms,
  getApiChannelsByIdShows,
  getApiProgramsByIdChildren,
} from '../../generated/sdk.gen.ts';
import { isNonEmptyString } from '../../helpers/util.ts';
import type { GridItemProps } from '../channel_config/MediaItemGrid.tsx';
import { MediaItemGrid } from '../channel_config/MediaItemGrid.tsx';
import { ProgramGridItem } from '../library/ProgramGridItem.tsx';

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
      result: Array<Show> | Array<MusicArtist>;
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

  const renderParentProgramGridItem = useCallback(
    (props: GridItemProps<ProgramOrFolder>) => (
      <ProgramGridItem
        key={props.item.uuid}
        // disableSelection={disableProgramSelection}
        disableSelection
        persisted
        {...props}
      />
    ),
    [],
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
              parentId={props.parent?.uuid}
            />
          )}
          renderGridItem={renderParentProgramGridItem}
          getItemKey={(p) => p.uuid}
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
              parentId={props.parent?.uuid}
            />
          )}
          renderGridItem={renderParentProgramGridItem}
          getItemKey={(p) => p.uuid}
          depth={depth}
        />
      ) : (
        <MediaItemGrid
          infiniteQuery={terminalQuery}
          getPageDataSize={(page) => ({ size: page.length })}
          extractItems={identity}
          renderNestedGrid={() => null}
          renderGridItem={renderParentProgramGridItem}
          getItemKey={(p) => p.uuid}
          depth={depth}
        />
      )}
    </Box>
  );
};
