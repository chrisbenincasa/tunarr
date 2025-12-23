import { Box } from '@mui/material';
import {
  isTerminalItemType,
  type MediaSourceSettings,
  type ProgramOrFolder,
} from '@tunarr/types';
import type { PagedResult } from '@tunarr/types/api';
import type {
  JellyfinItemKind,
  JellyfinItemSortBy,
} from '@tunarr/types/jellyfin';
import { isEmpty, isUndefined, last } from 'lodash-es';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NonEmptyArray } from 'ts-essentials';
import { match, P } from 'ts-pattern';
import {
  estimateNumberOfColumns,
  isNonEmptyString,
} from '../../../helpers/util.ts';
import { useProgramHierarchy } from '../../../hooks/channel_config/useProgramHierarchy.ts';
import { useInfiniteJellyfinLibraryItems } from '../../../hooks/jellyfin/useJellyfinApi.ts';
import useStore from '../../../store/index.ts';
import type { JellyfinMediaSourceView } from '../../../store/programmingSelector/store.ts';
import type { Nullable } from '../../../types/util.ts';
import { LibraryListViewBreadcrumbs } from '../../library/LibraryListViewBreadcrumbs.tsx';
import { ProgramGridItem } from '../../library/ProgramGridItem.tsx';
import { ProgramListItem } from '../../library/ProgramListItem.tsx';
import type { GridItemProps, NestedGridProps } from '../MediaItemGrid.tsx';
import { MediaItemGrid } from '../MediaItemGrid.tsx';
import { MediaItemList } from '../MediaItemList.tsx';

type Props = {
  selectedServer: MediaSourceSettings;
  selectedLibrary: JellyfinMediaSourceView;
  parentContext?: Nullable<ProgramOrFolder>;
  depth?: number;
};

export const JellyfinProgramGrid = ({
  selectedServer,
  selectedLibrary,
  parentContext,
  depth = 0,
}: Props) => {
  const itemContainer = useRef<HTMLDivElement | null>(null);
  const viewType = useStore((state) => state.theme.programmingSelectorView);
  const [columns, setColumns] = useState(8);
  const [bufferSize, setBufferSize] = useState(0);
  const programHierarchy = useProgramHierarchy(
    useCallback((p: ProgramOrFolder) => p.uuid, []),
  );
  const [alphanumericFilter, setAlphanumericFilter] = useState<string | null>(
    null,
  );

  const currentParentContext = useMemo(
    () => parentContext ?? last(programHierarchy.parentContext),
    [parentContext, programHierarchy.parentContext],
  );

  const itemTypes: JellyfinItemKind[] = useMemo(() => {
    if (!isEmpty(currentParentContext)) {
      return match(currentParentContext)
        .returnType<JellyfinItemKind[]>()
        .when(isTerminalItemType, () => [])
        .with({ type: 'album' }, () => ['Audio'])
        .with({ type: 'artist' }, () => ['MusicAlbum'])
        .with({ type: 'season' }, () => ['Episode'])
        .with({ type: 'show' }, () => ['Season'])
        .with({ type: P.union('collection', 'folder', 'playlist') }, () => [])
        .exhaustive();
    } else if (selectedLibrary?.view.childType) {
      switch (selectedLibrary.view.childType) {
        case 'movie':
          return ['Movie'];
        case 'show':
          return ['Series'];
        case 'artist':
          return ['MusicArtist'];
        default:
          return [];
      }
    }

    return [];
  }, [currentParentContext, selectedLibrary.view.childType]);

  const sortBy = useMemo(() => {
    return match(selectedLibrary?.view.childType)
      .returnType<NonEmptyArray<JellyfinItemSortBy>>()
      .with('other_video', () => ['IsFolder', 'SortName'])
      .otherwise(() => ['IsFolder', 'SortName', 'ProductionYear']);
  }, [selectedLibrary?.view.childType]);

  const genre = useStore((s) => s.currentMediaGenre);

  const jellyfinItemsQuery = useInfiniteJellyfinLibraryItems(
    selectedServer?.id,
    selectedLibrary?.view?.uuid,
    currentParentContext?.externalId ?? selectedLibrary?.view.externalId ?? '',
    itemTypes,
    /**enabled= */ isUndefined(depth) ||
      depth === 0 ||
      (depth > 0 && !!parentContext),
    columns * 4, // grab 4 rows
    bufferSize,
    useMemo(
      () => ({
        nameLessThan: alphanumericFilter === '#' ? 'A' : undefined,
        nameStartsWith:
          isNonEmptyString(alphanumericFilter) && alphanumericFilter !== '#'
            ? alphanumericFilter.toUpperCase()
            : undefined,
        sortBy,
        recursive: match(selectedLibrary?.view.childType)
          .with(P.union('show', 'movie'), () => true)
          .with(P.nullish, () => true)
          .otherwise(() => false),
        genres: genre,
      }),
      [alphanumericFilter, genre, selectedLibrary?.view.childType, sortBy],
    ),
  );

  useEffect(() => {
    const containerWidth =
      itemContainer?.current?.getBoundingClientRect().width || 0;
    const padding = 16; // to do: don't hardcode this
    // We have to estimate the number of columns because the items aren't loaded yet to use their width to calculate it
    const numberOfColumns = estimateNumberOfColumns(containerWidth + padding);

    if (jellyfinItemsQuery.data) {
      const numberOfFetches = jellyfinItemsQuery.data?.pages.length || 1;
      const previousFetch = jellyfinItemsQuery.data?.pages[numberOfFetches - 1];
      const prevNumberOfColumns =
        jellyfinItemsQuery.data?.pages[numberOfFetches - 1].total;

      // Calculate total number of fetched items so far
      // Take total records, subtract current offset and last fetch #
      //jellyfinItemsQuery.data?.pages[numberOfFetches-1].TotalRecordCount - (
      const currentTotalSize =
        previousFetch.result.length + (previousFetch.offset ?? 0);

      // Calculate total items that don't fill an entire row
      const leftOvers = currentTotalSize % numberOfColumns;

      // Calculate total items that are needed to fill the remainder of the row
      const bufferSize = numberOfColumns - leftOvers;

      if (prevNumberOfColumns !== numberOfColumns && prevNumberOfColumns) {
        setBufferSize(bufferSize);
      }
    }
    setColumns(numberOfColumns);
  }, [itemContainer, jellyfinItemsQuery.data]);

  const getPageDataSize = useCallback(
    (page: PagedResult<ProgramOrFolder[]>) => ({
      total: page.total,
      size: page.result.length,
    }),
    [],
  );

  const extractItems = useCallback(
    (page: PagedResult<ProgramOrFolder[]>) => page.result,
    [],
  );

  const getItemKey = useCallback((item: ProgramOrFolder) => item.uuid, []);

  const renderNestedGrid = useCallback(
    (props: NestedGridProps<ProgramOrFolder>) => {
      return (
        <JellyfinProgramGrid
          {...props}
          selectedLibrary={selectedLibrary}
          selectedServer={selectedServer}
          parentContext={props.parent}
        />
      );
    },
    [selectedLibrary, selectedServer],
  );

  const renderGridItem = useCallback(
    (props: GridItemProps<ProgramOrFolder>) => (
      <ProgramGridItem key={props.item.uuid} {...props} />
    ),
    [],
  );

  return (
    <Box ref={itemContainer}>
      {viewType === 'grid' ? (
        <MediaItemGrid
          getPageDataSize={getPageDataSize}
          extractItems={extractItems}
          getItemKey={getItemKey}
          infiniteQuery={jellyfinItemsQuery}
          depth={depth}
          renderNestedGrid={renderNestedGrid}
          renderGridItem={renderGridItem}
          showAlphabetFilter={depth === 0}
          handleAlphaNumFilter={setAlphanumericFilter}
        />
      ) : (
        <>
          <LibraryListViewBreadcrumbs {...programHierarchy} />
          <MediaItemList
            infiniteQuery={jellyfinItemsQuery}
            getPageDataSize={(page) => ({
              total: page.total,
              size: page.result.length,
            })}
            extractItems={(page) => page.result}
            renderListItem={({ item, index, style }) => (
              <ProgramListItem
                key={item.uuid}
                item={item}
                index={index}
                style={style}
                onPushParent={programHierarchy.pushParentContext}
              />
            )}
          />
        </>
      )}
    </Box>
  );
};
