import { Box, LinearProgress, Typography } from '@mui/material';
import type {
  InfiniteData,
  UseInfiniteQueryResult,
} from '@tanstack/react-query';
import { compact, flatMap } from 'lodash-es';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  FixedSizeList,
  type ListChildComponentProps,
  type ListOnItemsRenderedProps,
} from 'react-window';
import { useResizeObserver } from 'usehooks-ts';
import { TopBarPadddingPx } from './MediaItemGrid.tsx';

export interface ListItemProps<ItemType> {
  item: ItemType;
  index: number;
  style?: React.CSSProperties;
}

export type MediaItemListProps<PageDataType, ItemType> = {
  infiniteQuery: UseInfiniteQueryResult<InfiniteData<PageDataType>>;
  getPageDataSize: (page: PageDataType) => { total?: number; size: number };
  extractItems: (page: PageDataType) => ItemType[];
  renderListItem: (listItemProps: ListItemProps<ItemType>) => JSX.Element;
};

export function MediaItemList<PageDataType, ItemType>(
  props: MediaItemListProps<PageDataType, ItemType>,
) {
  const {
    extractItems,
    getPageDataSize,
    infiniteQuery: {
      data,
      hasNextPage,
      isFetchingNextPage,
      fetchNextPage,
      isLoading,
    },
    renderListItem,
  } = props;
  const containerRef = useRef<HTMLDivElement>(null);

  const [scrollParams, setScrollParams] = useState({ limit: 0, max: -1 });

  const pageSize = useMemo(() => {
    const firstPage = data?.pages?.[0];
    return firstPage ? getPageDataSize(firstPage)?.size : undefined;
  }, [data?.pages, getPageDataSize]);

  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(() => {
    const totalHeight = window.innerHeight;
    const containerOffset =
      gridContainerRef.current?.getBoundingClientRect().top;
    return containerOffset
      ? totalHeight - containerOffset - TopBarPadddingPx
      : undefined;
  });

  useResizeObserver({
    ref: gridContainerRef,
    onResize: () => {
      const totalHeight = window.innerHeight;
      const containerOffset =
        gridContainerRef.current?.getBoundingClientRect().top;

      const containerHeight = containerOffset
        ? totalHeight - containerOffset - TopBarPadddingPx
        : undefined;
      setContainerHeight(containerHeight);
      // containerHeight = size
    },
  });

  const loadedItems = useMemo(
    () => compact(flatMap(data?.pages, extractItems)),
    [data?.pages, extractItems],
  );

  const maybeTriggerFetchNext = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage().catch(console.error);
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const onListItemsRendered = (props: ListOnItemsRenderedProps) => {
    if (props.visibleStopIndex >= loadedItems.length - (pageSize ?? 50)) {
      if (scrollParams.limit < scrollParams.max) {
        setScrollParams(({ limit: prevLimit, max }) => ({
          max,
          limit: prevLimit * 5,
        }));
      }

      maybeTriggerFetchNext();
    }
  };

  const renderLoadMoreIntersection = () => {
    return (
      !isLoading &&
      hasNextPage && (
        <div
          style={{
            height: 200,
          }}
          // ref={ref}
        ></div>
      )
    );
  };

  const renderListRow = (props: ListChildComponentProps) => {
    if (props.index === loadedItems.length) {
      return renderLoadMoreIntersection();
    }

    const item = loadedItems[props.index];
    return renderListItem({
      item,
      index: props.index,
      style: props.style,
    });
  };

  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'relative',
        minHeight: '100%',
      }}
    >
      {isFetchingNextPage && <LinearProgress />}
      <Box ref={gridContainerRef} sx={{ width: '100%' }}>
        <FixedSizeList
          height={containerHeight ?? 800}
          width={'100%'}
          itemSize={61}
          itemCount={loadedItems.length}
          onItemsRendered={onListItemsRendered}
          overscanCount={10}
        >
          {renderListRow}
        </FixedSizeList>
        {data && scrollParams.max === 0 && !hasNextPage && (
          <Typography
            variant="h6"
            fontStyle={'italic'}
            sx={{ textAlign: 'center', mt: 2 }}
          >
            No results
          </Typography>
        )}
      </Box>
    </Box>
  );
}
