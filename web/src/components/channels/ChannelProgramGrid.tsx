import { Box } from '@mui/material';
import { useInfiniteQuery } from '@tanstack/react-query';
import type {
  ContentProgramParent,
  Episode,
  MusicAlbum,
  MusicArtist,
  MusicTrack,
  ProgramOrFolder,
  Season,
  Show,
  TerminalProgram,
} from '@tunarr/types';
import type { PagedResult, ProgramChildrenResult } from '@tunarr/types/api';
import { type ContentProgramType } from '@tunarr/types/schemas';
import { sumBy } from 'lodash-es';
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
    getNextPageParam: (currentPage, pages) => {
      if ((currentPage.result?.length ?? 0) === 0) {
        return null;
      }

      const totalSize = sumBy(pages, (page) => page.result.length);
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
    }): Promise<PagedResult<Show[] | MusicArtist[]>> => {
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

  const renderProgramGridItem = useCallback(
    <T extends ProgramOrFolder>(props: GridItemProps<T>) => (
      <ProgramGridItem
        key={props.item.uuid}
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
        <MediaItemGrid<PagedResult<MusicArtist[] | Show[]>, MusicArtist | Show>
          infiniteQuery={nestedQuery}
          extractItems={(page) => page.result}
          getPageDataSize={(page) => ({
            size: page.result.length,
            total: page.total,
          })}
          renderNestedGrid={(props) => (
            <ChannelProgramGrid
              channelId={channelId}
              depth={props.depth}
              programType={ProgramTypeToChildType[programType]!}
              parentId={props.parent?.uuid}
            />
          )}
          renderGridItem={renderProgramGridItem}
          getItemKey={(p) => p.uuid}
          depth={depth}
        />
      ) : gridType === 'nested' ? (
        <MediaItemGrid<
          ProgramChildrenResult,
          Season | Episode | MusicTrack | MusicAlbum
        >
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
          renderGridItem={renderProgramGridItem}
          getItemKey={(p) => p.uuid}
          depth={depth}
        />
      ) : (
        <MediaItemGrid<PagedResult<TerminalProgram[]>, TerminalProgram>
          infiniteQuery={terminalQuery}
          getPageDataSize={(page) => ({
            size: page.result.length,
            total: page.total,
          })}
          extractItems={(page) => page.result}
          renderNestedGrid={() => null}
          renderGridItem={(props: GridItemProps<TerminalProgram>) => {
            return renderProgramGridItem(props);
          }}
          getItemKey={(p) => p.uuid}
          depth={depth}
        />
      )}
    </Box>
  );
};
