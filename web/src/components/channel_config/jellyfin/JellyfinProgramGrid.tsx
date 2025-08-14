import { Box } from '@mui/material';
import type { MediaSourceSettings } from '@tunarr/types';
import { tag } from '@tunarr/types';
import type {
  JellyfinItem,
  JellyfinItemKind,
  JellyfinItemSortBy,
  JellyfinLibraryItemsResponse,
} from '@tunarr/types/jellyfin';
import type { MediaSourceId } from '@tunarr/types/schemas';
import { isEmpty, isUndefined, last } from 'lodash-es';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NonEmptyArray } from 'ts-essentials';
import { match, P } from 'ts-pattern';
import {
  extractJellyfinItemId,
  jellyfinChildType,
} from '../../../helpers/jellyfinUtil.ts';
import {
  estimateNumberOfColumns,
  isNonEmptyString,
} from '../../../helpers/util.ts';
import { useProgramHierarchy } from '../../../hooks/channel_config/useProgramHierarchy.ts';
import { useInfiniteJellyfinLibraryItems } from '../../../hooks/jellyfin/useJellyfinApi.ts';
import useStore from '../../../store/index.ts';
import type { JellyfinMediaSourceView } from '../../../store/programmingSelector/store.ts';
import type { Nullable } from '../../../types/util.ts';
import type { GridItemProps, NestedGridProps } from '../MediaItemGrid.tsx';
import { MediaItemGrid } from '../MediaItemGrid.tsx';
import { MediaItemList } from '../MediaItemList.tsx';
import { JellyfinGridItem } from './JellyfinGridItem.tsx';
import { JellyfinListItem } from './JellyfinListItem.tsx';
import { JellyfinListViewBreadcrumbs } from './JellyfinListViewBreadcrumbs.tsx';

type Props = {
  selectedServer: MediaSourceSettings;
  selectedLibrary: JellyfinMediaSourceView;
  parentContext?: Nullable<JellyfinItem>;
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
  const programHierarchy = useProgramHierarchy(extractJellyfinItemId);
  const [alphanumericFilter, setAlphanumericFilter] = useState<string | null>(
    null,
  );

  const currentParentContext = useMemo(
    () => parentContext ?? last(programHierarchy.parentContext),
    [parentContext, programHierarchy.parentContext],
  );

  const itemTypes: JellyfinItemKind[] = useMemo(() => {
    if (!isEmpty(currentParentContext)) {
      return jellyfinChildType(currentParentContext) ?? [];
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

  const sortBy: NonEmptyArray<JellyfinItemSortBy> | null = useMemo(() => {
    return match(selectedLibrary?.view.CollectionType)
      .returnType<Nullable<NonEmptyArray<JellyfinItemSortBy>>>()
      .with('homevideos', () => ['IsFolder', 'SortName'])
      .otherwise(() => ['IsFolder', 'SortName', 'ProductionYear']);
  }, [selectedLibrary?.view.CollectionType]);

  const genre = useStore((s) => s.currentMediaGenre);

  const jellyfinItemsQuery = useInfiniteJellyfinLibraryItems(
    selectedServer?.id ?? tag<MediaSourceId>(''),
    currentParentContext?.Id ?? selectedLibrary?.view.ItemId ?? '',
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
        recursive: match(selectedLibrary?.view.CollectionType)
          .with(P.union('tvshows', 'movies', 'folders'), () => true)
          .otherwise(() => false),
        genres: genre,
      }),
      [alphanumericFilter, genre, selectedLibrary?.view.CollectionType, sortBy],
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
        jellyfinItemsQuery.data?.pages[numberOfFetches - 1].TotalRecordCount;

      // Calculate total number of fetched items so far
      // Take total records, subtract current offset and last fetch #
      //jellyfinItemsQuery.data?.pages[numberOfFetches-1].TotalRecordCount - (
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
  }, [itemContainer, jellyfinItemsQuery.data]);

  const getPageDataSize = useCallback(
    (page: JellyfinLibraryItemsResponse) => ({
      total: page.TotalRecordCount,
      size: page.Items.length,
    }),
    [],
  );

  const extractItems = useCallback(
    (page: JellyfinLibraryItemsResponse) => page.Items,
    [],
  );

  const getItemKey = useCallback((item: JellyfinItem) => item.Id, []);

  const renderNestedGrid = useCallback(
    (props: NestedGridProps<JellyfinItem>) => {
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
    (props: GridItemProps<JellyfinItem>) => (
      <JellyfinGridItem key={props.item.Id} {...props} />
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
          <JellyfinListViewBreadcrumbs {...programHierarchy} />
          <MediaItemList
            infiniteQuery={jellyfinItemsQuery}
            getPageDataSize={(page) => ({
              total: page.TotalRecordCount,
              size: page.Items.length,
            })}
            extractItems={(page) => page.Items}
            renderListItem={({ item, index, style }) => (
              <JellyfinListItem
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
