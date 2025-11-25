import {
  findLastItemInRowIndex,
  getImagesPerRow,
} from '@/helpers/inlineModalUtil.ts';
import type { Nullable } from '@/types/util';
import {
  Box,
  CircularProgress,
  Grid,
  LinearProgress,
  Typography,
} from '@mui/material';
import type {
  InfiniteData,
  UseInfiniteQueryResult,
} from '@tanstack/react-query';
import { usePrevious } from '@uidotdev/usehooks';
import {
  compact,
  first,
  flatMap,
  isNil,
  isUndefined,
  map,
  sumBy,
} from 'lodash-es';
import type { ComponentType, ForwardedRef, ReactNode } from 'react';
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  useDebounceCallback,
  useIntersectionObserver,
  useResizeObserver,
} from 'usehooks-ts';
import { InlineModal } from '../InlineModal.tsx';
import { AlphanumericFilters } from './AlphanumericFilters.tsx';

export interface GridItemProps<ItemType> {
  item: ItemType;
  index: number;
  isModalOpen: boolean;
  moveModal: (index: number, item: ItemType) => void;
  depth: number;
  ref: ForwardedRef<HTMLDivElement>;
  disableSelection?: boolean;
  persisted?: boolean; // Temp hack
}

export interface ListItemProps<ItemType> {
  item: ItemType;
  index: number;
  style?: React.CSSProperties;
  disableSelection?: boolean;
}

export type RenderGridItem<ItemType> = ComponentType<GridItemProps<ItemType>>;

export interface NestedGridProps<ItemType> {
  parent: Nullable<ItemType>;
  depth: number;
}

export type RenderNestedGrid<ItemType> = (
  props: NestedGridProps<ItemType>,
) => ReactNode;

export interface GridInlineModalProps<ItemType> {
  open: boolean;
  modalItem: Nullable<ItemType>;
  modalIndex: number;
  rowSize: number;
  depth: number;
}

type MediaItemGridProps<PageDataType, ItemType> = {
  getPageDataSize: (page: PageDataType) => { total?: number; size: number };
  extractItems: (page: PageDataType) => ItemType[];
  getItemKey: (item: ItemType) => string;
  infiniteQuery: UseInfiniteQueryResult<InfiniteData<PageDataType>>;
  showAlphabetFilter?: boolean;
  // Generally this applies some filter on the underlying
  // query, changing the items displayed.
  handleAlphaNumFilter?: (key: string | null) => void;
  renderNestedGrid: RenderNestedGrid<ItemType>;
  renderGridItem: (props: GridItemProps<ItemType>) => ReactNode;
  depth?: number;
};

type ModalState<ItemType> = {
  modalIndex: number;
  modalItem: Nullable<ItemType>;
};

// magic number for top bar padding; TODO: calc it off ref
export const TopBarPadddingPx = 64;
export const StickyHeaderPaddingPx = 60.5;

export function MediaItemGrid<PageDataType, ItemType>(
  props: MediaItemGridProps<PageDataType, ItemType>,
) {
  const {
    getPageDataSize,
    getItemKey,
    extractItems,
    infiniteQuery: {
      data,
      hasNextPage,
      isFetchingNextPage,
      fetchNextPage,
      isLoading,
    },
    showAlphabetFilter = true,
    handleAlphaNumFilter,
    renderNestedGrid,
    renderGridItem,
    depth = 0,
  } = props;
  const [scrollParams, setScrollParams] = useState({ limit: 0, max: -1 });
  const [rowSize, setRowSize] = useState(9);
  const [{ modalIndex, modalItem }, setModalState] = useState<
    ModalState<ItemType>
  >({
    modalItem: null,
    modalIndex: -1,
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const selectedModalItemRef = useRef<HTMLDivElement>(null);

  // We only need a single grid item ref because all grid items are the same
  // width. This ref is simply used to determine the width of grid items based
  // on window/container size in order to derive other details about the grid.
  // If the modal is open, this ref points to the selected dmain grid element,
  // otherwise, it uses the first element in the grid
  const [gridItemRef, setGridItemRef] = useState<HTMLDivElement | null>(null);
  const alphaFilterRef = useRef<HTMLDivElement>(null);

  const loadedItems = compact(flatMap(data?.pages, extractItems));

  const containerMinHeight = useMemo(() => {
    if (depth > 0) {
      return;
    }

    const height = gridItemRef?.getBoundingClientRect()?.height;
    const alphaFilterHeight =
      alphaFilterRef?.current?.getBoundingClientRect()?.height || 775; // 775 is approx desktop size as backup

    if (isNil(height)) {
      return alphaFilterHeight;
    }

    const page = first(data?.pages);
    if (isNil(page)) {
      return alphaFilterHeight;
    }

    const total = getPageDataSize(page)?.total;

    if (isNil(total)) {
      return alphaFilterHeight;
    }

    const maxHeight =
      Math.ceil(total / rowSize) * height + (hasNextPage ? height : 48);

    const numRows = Math.ceil(loadedItems.length / rowSize);

    // Either set the height of the container to 3 extra rows on top of what is loaded
    // or the max height
    const calculatedMinHeight = Math.min((numRows + 3) * height, maxHeight);

    // If the calculated min height is less than the height of Alphabet Filters, use filter height
    return Math.max(calculatedMinHeight, alphaFilterHeight);
  }, [
    depth,
    gridItemRef,
    data?.pages,
    getPageDataSize,
    rowSize,
    hasNextPage,
    loadedItems.length,
  ]);

  const handleAlphaFilterChange = useCallback(
    (key: string | null) => {
      scrollTo({
        top: 0,
        left: 0,
        behavior: 'smooth',
      });

      handleAlphaNumFilter?.(key);
    },
    [handleAlphaNumFilter],
  );

  const previousModalIndex = usePrevious(modalIndex);

  const setSizeDependentFields = useDebounceCallback(
    (containerWidth?: number, gridItemWidth?: number) => {
      const newRowSize = getImagesPerRow(
        containerWidth ? containerWidth + 16 : 0,
        isNil(gridItemWidth) ? 0 : gridItemWidth + 16,
      );
      if (newRowSize !== rowSize) {
        setRowSize(newRowSize);
        setScrollParams(({ max }) => ({ max, limit: newRowSize * 4 }));
      }
    },
    500,
  );

  useResizeObserver({
    ref: gridContainerRef,
    onResize: (size) => {
      setSizeDependentFields(
        size?.width,
        gridItemRef?.getBoundingClientRect()?.width,
      );
    },
  });

  const scrollToGridItem = useCallback(
    (index: number) => {
      // Don't scroll when closing the modal.
      if (index === -1) {
        return;
      }

      const selectedElement = selectedModalItemRef.current;
      const previousRowNumber = Math.floor(previousModalIndex / rowSize);
      const newRowNumber = Math.floor(index / rowSize);

      // Don't scroll is the row is the same
      if (previousRowNumber === newRowNumber) {
        return;
      }

      const top = selectedElement?.getBoundingClientRect().top;
      const scroll = window.scrollY;

      if (selectedElement && !isUndefined(top)) {
        // Take nested items into account
        const nestedHeight =
          (gridItemRef?.getBoundingClientRect().height ?? 0) *
          Math.max(depth - 1, 0);
        const newTop = top + scroll - TopBarPadddingPx - StickyHeaderPaddingPx;
        window.scrollTo({
          top: newTop + nestedHeight,
          behavior: 'smooth',
        });
      }
    },
    [depth, gridItemRef, previousModalIndex, rowSize],
  );

  // Scroll to new selected item when modalIndex changes
  // Doing this on modalIndex change negates the need to calc inline modal height since it's collapsed at this time
  useEffect(() => {
    scrollToGridItem(modalIndex);
  }, [modalIndex, scrollToGridItem]);

  const handleMoveModal = useCallback((index: number, item: ItemType) => {
    // const key = getItemKey(item);
    setModalState((prev) => {
      if (prev.modalIndex === index) {
        return { modalItem: null, modalIndex: -1 };
      } else {
        return { modalItem: item, modalIndex: index };
      }
    });
  }, []);

  useEffect(() => {
    if (data?.pages.length === 1) {
      const { total, size } = getPageDataSize(data.pages[0]);
      const actualSize = total ?? size;
      if (scrollParams.max !== actualSize) {
        setScrollParams(({ limit }) => ({
          limit,
          max: actualSize,
        }));
      }
    }
  }, [data?.pages, getPageDataSize, scrollParams.max, depth]);

  const maybeTriggerFetchNext = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage().catch(console.error);
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const { ref } = useIntersectionObserver({
    onChange: (_, entry) => {
      if (entry.isIntersecting) {
        if (scrollParams.limit < scrollParams.max) {
          setScrollParams(({ limit: prevLimit, max }) => ({
            max,
            limit: Math.ceil((prevLimit + rowSize * 5) / rowSize) * rowSize,
          }));
        }

        maybeTriggerFetchNext();
      }
    },
    threshold: 0,
    rootMargin: '100px 0px 0px 0px',
  });

  // InlineModals are only potentially rendered for the last item in each row
  // As such, we need to find the index of the last item in a given row, relative
  // to the index of the selected item, row size, and total items.
  const lastItemIndex = useMemo(
    () =>
      findLastItemInRowIndex(
        modalIndex,
        rowSize,
        sumBy(data?.pages, (page) => getPageDataSize(page).size) ?? 0,
      ),
    [modalIndex, rowSize, data?.pages, getPageDataSize],
  );

  const totalItems = useMemo(() => {
    const page = first(data?.pages);
    if (page) {
      return getPageDataSize(page)?.total ?? 0;
    }
    return 0;
  }, [data?.pages, getPageDataSize]);

  const renderGridItems = () => {
    return map(loadedItems, (item, index) => {
      const isOpen = index === lastItemIndex;
      const isLast = index === totalItems - 1;
      const renderModal = (index + 1) % rowSize === 0 || isLast;
      const gridItem = renderGridItem({
        item,
        index,
        isModalOpen: modalIndex === index,
        depth,
        moveModal: handleMoveModal,
        ref:
          index === 0
            ? (ref) => setGridItemRef(ref)
            : modalIndex === index
              ? selectedModalItemRef
              : null,
      });
      return (
        <Fragment key={getItemKey(item)}>
          {gridItem}
          {renderModal && (
            <InlineModal<ItemType>
              open={isOpen}
              modalItem={modalItem}
              depth={depth + 1}
              extractItemId={getItemKey}
              renderNestedGrid={(props) => renderNestedGrid(props)}
            />
          )}
        </Fragment>
      );
    });
  };

  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'relative',
        minHeight: containerMinHeight,
        pt: depth > 0 ? 1 : undefined,
      }}
    >
      {showAlphabetFilter && handleAlphaNumFilter && (
        <AlphanumericFilters onAlphaFilterChange={handleAlphaFilterChange} />
      )}

      <LinearProgress
        sx={{
          position: 'sticky',
          top: '125px',
          zIndex: 1000,
          visibility: isLoading || isFetchingNextPage ? 'visible' : 'hidden',
        }}
      />
      <Box ref={gridContainerRef} sx={{ width: '100%' }}>
        <Grid
          container
          component="div"
          spacing={2}
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            justifyContent: 'space-around',
            mt: depth === 0 ? 2 : undefined,
          }}
          ref={ref}
        >
          {renderGridItems()}
        </Grid>
      </Box>

      {!isLoading && hasNextPage && (
        <div
          style={{
            height: gridItemRef?.getBoundingClientRect()?.height ?? 200,
          }}
          ref={ref}
          className="loading-more-target"
        ></div>
      )}
      {isFetchingNextPage && (
        <CircularProgress
          color="primary"
          sx={{ display: 'block', margin: '2em auto' }}
        />
      )}
      {data && scrollParams.max === 0 && !hasNextPage && (
        <Typography
          variant="h6"
          fontStyle={'italic'}
          sx={{ textAlign: 'center', mt: 2 }}
        >
          No results
        </Typography>
      )}
      {depth === 0 && data && scrollParams.max !== 0 && !hasNextPage && (
        <Typography
          variant="h6"
          fontStyle={'italic'}
          sx={{ textAlign: 'center', mt: 2 }}
        >
          The End.
        </Typography>
      )}
    </Box>
  );
}
