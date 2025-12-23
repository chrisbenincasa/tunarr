import { Box } from '@mui/material';
import type { ProgramOrFolder } from '@tunarr/types';
import { isTerminalItemType, type MediaSourceSettings } from '@tunarr/types';
import type { PagedResult } from '@tunarr/types/api';
import type { EmbyItemKind, EmbyItemSortBy } from '@tunarr/types/emby';
import { isEmpty, last } from 'lodash-es';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NonEmptyArray } from 'ts-essentials';
import { match, P } from 'ts-pattern';
import { estimateNumberOfColumns } from '../../../helpers/util.ts';
import { useProgramHierarchy } from '../../../hooks/channel_config/useProgramHierarchy.ts';
import { useInfiniteEmbyLibraryItems } from '../../../hooks/emby/useEmbyApi.ts';
import useStore from '../../../store/index.ts';
import type { EmbyMediaSourceView } from '../../../store/programmingSelector/store.ts';
import { LibraryListViewBreadcrumbs } from '../../library/LibraryListViewBreadcrumbs.tsx';
import { ProgramGridItem } from '../../library/ProgramGridItem.tsx';
import { ProgramListItem } from '../../library/ProgramListItem.tsx';
import type { GridItemProps, NestedGridProps } from '../MediaItemGrid.tsx';
import { MediaItemGrid } from '../MediaItemGrid.tsx';
import { MediaItemList } from '../MediaItemList.tsx';

type Props = {
  selectedServer: MediaSourceSettings;
  selectedLibrary: EmbyMediaSourceView;
  parentContext: ProgramOrFolder[];
  alphanumericFilter: string | null;
  depth?: number;
};

export const EmbyProgramGrid = ({
  selectedServer,
  selectedLibrary,
  alphanumericFilter,
  parentContext,
  depth,
}: Props) => {
  const itemContainer = useRef<HTMLDivElement | null>(null);
  const viewType = useStore((state) => state.theme.programmingSelectorView);
  const [columns, setColumns] = useState(8);
  const [bufferSize, setBufferSize] = useState(0);
  const programHierarchy = useProgramHierarchy(
    useCallback((item: ProgramOrFolder) => item.uuid, []),
  );

  // This is sort of confusing. The grid view is rendered recursively
  // so we pass parentContext through props, while the list view uses
  // the hook to track parent contexts
  const currentParentContext =
    last(parentContext) ?? last(programHierarchy.parentContext);
  const itemTypes: EmbyItemKind[] = useMemo(() => {
    if (!isEmpty(currentParentContext)) {
      return match(currentParentContext)
        .returnType<EmbyItemKind[]>()
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
      .returnType<NonEmptyArray<EmbyItemSortBy>>()
      .with('other_video', () => ['IsFolder', 'SortName'])
      .otherwise(() => ['IsFolder', 'SortName', 'ProductionYear']);
  }, [selectedLibrary?.view.childType]);

  const itemsQuery = useInfiniteEmbyLibraryItems(
    selectedServer?.id ?? '',
    selectedLibrary?.view.uuid ?? '',
    currentParentContext?.externalId ?? selectedLibrary?.view.externalId ?? '',
    itemTypes,
    true,
    columns * 4, // grab 4 rows
    bufferSize,
    {
      nameLessThan: alphanumericFilter === '#' ? 'A' : undefined,
      nameStartsWith:
        alphanumericFilter !== null && alphanumericFilter !== '#'
          ? alphanumericFilter.toUpperCase()
          : undefined,
      sortBy,
      recursive: true,
      artistType:
        selectedLibrary?.view.childType === 'artist'
          ? ['AlbumArtist']
          : undefined,
    },
  );

  useEffect(() => {
    const containerWidth =
      itemContainer?.current?.getBoundingClientRect().width || 0;
    const padding = 16; // to do: don't hardcode this
    // We have to estimate the number of columns because the items aren't loaded yet to use their width to calculate it
    const numberOfColumns = estimateNumberOfColumns(containerWidth + padding);

    if (itemsQuery.data) {
      const numberOfFetches = itemsQuery.data?.pages.length || 1;
      const previousFetch = itemsQuery.data?.pages[numberOfFetches - 1];
      const prevNumberOfColumns =
        itemsQuery.data?.pages[numberOfFetches - 1].total;

      // Calculate total number of fetched items so far
      // Take total records, subtract current offset and last fetch #
      //itemsQuery.data?.pages[numberOfFetches-1].TotalRecordCount - (
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
  }, [itemContainer, itemsQuery.data]);

  const getPageDataSize = useCallback(
    (page: PagedResult<ProgramOrFolder[]>) => ({
      total: page.total,
      size: page.size,
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
        <EmbyProgramGrid
          {...props}
          selectedLibrary={selectedLibrary}
          selectedServer={selectedServer}
          alphanumericFilter={alphanumericFilter}
          parentContext={props.parent ? [props.parent] : []}
        />
      );
    },
    [alphanumericFilter, selectedLibrary, selectedServer],
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
          infiniteQuery={itemsQuery}
          depth={depth}
          renderNestedGrid={renderNestedGrid}
          renderGridItem={renderGridItem}
          // handleAlphaNumFilter={setAlphanumericFilter}
        />
      ) : (
        <>
          <LibraryListViewBreadcrumbs {...programHierarchy} />
          <MediaItemList
            infiniteQuery={itemsQuery}
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
