import { Box } from '@mui/material';
import { type MediaSourceSettings } from '@tunarr/types';
import type {
  EmbyItem,
  EmbyItemKind,
  EmbyItemSortBy,
  EmbyLibraryItemsResponse,
} from '@tunarr/types/emby';
import { isEmpty, last } from 'lodash-es';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NonEmptyArray } from 'ts-essentials';
import { match } from 'ts-pattern';
import { embyChildType, extractEmbyId } from '../../../helpers/embyUtil.ts';
import { estimateNumberOfColumns } from '../../../helpers/util.ts';
import { useProgramHierarchy } from '../../../hooks/channel_config/useProgramHierarchy.ts';
import { useInfiniteEmbyLibraryItems } from '../../../hooks/emby/useEmbyApi.ts';
import useStore from '../../../store/index.ts';
import type { EmbyMediaSourceView } from '../../../store/programmingSelector/store.ts';
import type { GridItemProps, NestedGridProps } from '../MediaItemGrid.tsx';
import { MediaItemGrid } from '../MediaItemGrid.tsx';
import { MediaItemList } from '../MediaItemList.tsx';
import { EmbyGridItem } from './EmbyGridItem.tsx';
import { EmbyListItem } from './EmbyListItem.tsx';
import { EmbyListViewBreadcrumbs } from './EmbyListViewBreadcrumbs.tsx';

type Props = {
  selectedServer: MediaSourceSettings;
  selectedLibrary: EmbyMediaSourceView;
  parentContext: EmbyItem[];
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
  const programHierarchy = useProgramHierarchy(extractEmbyId);

  // This is sort of confusing. The grid view is rendered recursively
  // so we pass parentContext through props, while the list view uses
  // the hook to track parent contexts
  const currentParentContext =
    last(parentContext) ?? last(programHierarchy.parentContext);
  const itemTypes: EmbyItemKind[] = useMemo(() => {
    if (!isEmpty(currentParentContext)) {
      return embyChildType(currentParentContext) ?? [];
    } else if (selectedLibrary?.view.CollectionType) {
      switch (selectedLibrary.view.CollectionType) {
        case 'movies':
          return ['Movie'];
        case 'tvshows':
          return ['Series'];
        case 'music':
          return ['MusicArtist'];
        default:
          return [];
      }
    }

    return [];
  }, [currentParentContext, selectedLibrary.view.CollectionType]);

  const sortBy = useMemo(() => {
    return match(selectedLibrary?.view.CollectionType)
      .returnType<NonEmptyArray<EmbyItemSortBy>>()
      .with('homevideos', () => ['IsFolder', 'SortName'])
      .otherwise(() => ['IsFolder', 'SortName', 'ProductionYear']);
  }, [selectedLibrary?.view.CollectionType]);

  const itemsQuery = useInfiniteEmbyLibraryItems(
    selectedServer?.id ?? '',
    currentParentContext?.Id ?? selectedLibrary?.view.Id ?? '',
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
        selectedLibrary?.view.CollectionType === 'music'
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
        itemsQuery.data?.pages[numberOfFetches - 1].TotalRecordCount;

      // Calculate total number of fetched items so far
      // Take total records, subtract current offset and last fetch #
      //itemsQuery.data?.pages[numberOfFetches-1].TotalRecordCount - (
      const currentTotalSize =
        previousFetch.Items.length + (previousFetch.StartIndex || 0);

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
    (page: EmbyLibraryItemsResponse) => ({
      total: page.TotalRecordCount,
      size: page.Items.length,
    }),
    [],
  );

  const extractItems = useCallback(
    (page: EmbyLibraryItemsResponse) => page.Items,
    [],
  );

  const getItemKey = useCallback((item: EmbyItem) => item.Id, []);

  const renderNestedGrid = useCallback(
    (props: NestedGridProps<EmbyItem>) => {
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
    (props: GridItemProps<EmbyItem>) => (
      <EmbyGridItem key={props.item.Id} {...props} />
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
          <EmbyListViewBreadcrumbs {...programHierarchy} />
          <MediaItemList
            infiniteQuery={itemsQuery}
            getPageDataSize={(page) => ({
              total: page.TotalRecordCount,
              size: page.Items.length,
            })}
            extractItems={(page) => page.Items}
            renderListItem={({ item, index, style }) => (
              <EmbyListItem
                key={item.Id}
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
