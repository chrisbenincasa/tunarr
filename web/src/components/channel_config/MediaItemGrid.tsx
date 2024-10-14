import {
  findLastItemInRowIndex,
  getImagesPerRow,
  isNewModalAbove,
} from '@/helpers/inlineModalUtil.ts';
import useStore from '@/store/index.ts';
import { Nullable } from '@/types/util';
import {
  Box,
  Button,
  CircularProgress,
  Grid,
  List,
  Typography,
} from '@mui/material';
import { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';
import { usePrevious } from '@uidotdev/usehooks';
import {
  compact,
  first,
  flatMap,
  isEmpty,
  isNil,
  map,
  range,
  sumBy,
} from 'lodash-es';
import {
  ForwardedRef,
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

export interface GridItemProps<ItemType> {
  item: ItemType;
  index: number;
  isModalOpen: boolean;
  moveModal: (index: number, item: ItemType) => void;
  ref: ForwardedRef<HTMLDivElement>;
}

export interface GridInlineModalProps<ItemType> {
  open: boolean;
  modalItemGuid: Nullable<string>;
  modalIndex: number;
  rowSize: number;
  renderChildren: (
    gridItemProps: GridItemProps<ItemType>,
    modalProps: GridInlineModalProps<ItemType>,
  ) => JSX.Element;
}

type Props<PageDataType, ItemType> = {
  getPageDataSize: (page: PageDataType) => { total?: number; size: number };
  extractItems: (page: PageDataType) => ItemType[];
  renderGridItem: (
    gridItemProps: GridItemProps<ItemType>,
    modalProps: GridInlineModalProps<ItemType>,
  ) => JSX.Element;
  renderListItem: (item: ItemType, index: number) => JSX.Element;
  getItemKey: (item: ItemType) => string;
  infiniteQuery: UseInfiniteQueryResult<InfiniteData<PageDataType>>;
  showAlphabetFilter?: boolean;
  // Generally this applies some filter on the underlying
  // query, changing the items displayed.
  handleAlphaNumFilter?: (key: string | null) => void;
};

type Size = {
  width?: number;
  height?: number;
};

type ModalState = {
  modalIndex: number;
  modalGuid: Nullable<string>;
};

// magic number for top bar padding; TODO: calc it off ref
const TopBarPadddingPx = 64;
const AlphanumericCharCodes = [
  '#'.charCodeAt(0),
  ...range('a'.charCodeAt(0), 'z'.charCodeAt(0) + 1),
];

export function MediaItemGrid<PageDataType, ItemType>({
  getPageDataSize,
  renderGridItem,
  renderListItem,
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
}: Props<PageDataType, ItemType>) {
  const viewType = useStore((state) => state.theme.programmingSelectorView);
  const [scrollParams, setScrollParams] = useState({ limit: 0, max: -1 });
  const [rowSize, setRowSize] = useState(9);
  const [{ modalIndex, modalGuid }, setModalState] = useState<ModalState>({
    modalGuid: null,
    modalIndex: -1,
  });
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const selectedModalItemRef = useRef<HTMLDivElement>(null);
  const [alphanumericFilter, setAlphanumericFilter] = useState<string | null>(
    null,
  );

  // We only need a single grid item ref because all grid items are the same
  // width. This ref is simply used to determine the width of grid items based
  // on window/container size in order to derive other details about the grid.
  // If the modal is open, this ref points to the selected dmain grid element,
  // otherwise, it uses the first element in the grid
  const gridItemRef = useRef<HTMLDivElement>(null);

  const loadedItems = compact(flatMap(data?.pages, extractItems));

  const containerHeight = useMemo(() => {
    const height = gridItemRef?.current?.getBoundingClientRect()?.height;
    if (isNil(height)) {
      return;
    }

    const page = first(data?.pages);
    if (isNil(page)) {
      return;
    }

    const total = getPageDataSize(page)?.total;

    if (isNil(total)) {
      return;
    }

    const maxHeight =
      Math.ceil(total / rowSize) * height + (hasNextPage ? height : 48);

    const numRows = Math.ceil(loadedItems.length / rowSize);

    // Either set the height of the container to 3 extra rows on top of what is loaded
    // or the max height
    return Math.min((numRows + 3) * height, maxHeight);
  }, [data?.pages, getPageDataSize, hasNextPage, loadedItems.length, rowSize]);

  const handleAlphaFilterChange = useCallback(
    (key: string) => {
      if (isEmpty(key.trim())) {
        return;
      }

      const anum = key[0];
      if (!AlphanumericCharCodes.includes(anum.charCodeAt(0))) {
        return;
      }

      setAlphanumericFilter((prev) => (prev === anum ? null : anum));

      scrollTo();

      handleAlphaNumFilter?.(anum === alphanumericFilter ? null : anum);
    },
    [handleAlphaNumFilter, alphanumericFilter],
  );

  const previousModalIndex = usePrevious(modalIndex);

  const [{ width }, setSize] = useState<Size>({
    width: undefined,
    height: undefined,
  });

  const onResize = useDebounceCallback(setSize, 200);

  useResizeObserver({
    ref: gridContainerRef,
    onResize,
  });

  useEffect(() => {
    if (viewType === 'grid') {
      // 16 is additional padding available in the parent container
      const rowSize = getImagesPerRow(
        width ? width + 16 : 0,
        gridItemRef.current?.getBoundingClientRect().width ?? 0,
      );
      setRowSize(rowSize);
      setScrollParams(({ max }) => ({ max, limit: rowSize * 4 }));
    }
  }, [width, viewType, modalGuid, gridItemRef]);

  const scrollToGridItem = useCallback(
    (index: number) => {
      if (index === -1) {
        return;
      }

      const selectedElement = selectedModalItemRef.current;
      const includeModalInHeightCalc = isNewModalAbove(
        previousModalIndex,
        index,
        rowSize,
      );

      if (selectedElement) {
        // New modal is opening in a row above previous modal
        const modalMovesUp = selectedElement.offsetTop - TopBarPadddingPx;
        // New modal is opening in the same row or a row below the current modal
        const modalMovesDown =
          selectedElement.offsetTop -
          selectedElement.offsetHeight -
          TopBarPadddingPx;

        window.scrollTo({
          top: includeModalInHeightCalc ? modalMovesDown : modalMovesUp,
          behavior: 'smooth',
        });
      }
    },
    [previousModalIndex, rowSize],
  );

  // Scroll to new selected item when modalIndex changes
  // Doing this on modalIndex change negates the need to calc inline modal height since it's collapsed at this time
  useEffect(() => {
    scrollToGridItem(modalIndex);
  }, [modalIndex, scrollToGridItem]);

  const handleMoveModal = useCallback(
    (index: number, item: ItemType) => {
      const key = getItemKey(item);
      setModalState((prev) => {
        if (prev.modalIndex === index) {
          return { modalGuid: null, modalIndex: -1 };
        } else {
          return { modalGuid: key, modalIndex: index };
        }
      });
    },
    [getItemKey],
  );

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
  }, [data?.pages, getPageDataSize, scrollParams.max]);

  const maybeTriggerFetchNext = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      console.log('trigger');
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

  const renderItems = () => {
    return map(loadedItems, (item, index) => {
      const isOpen = index === lastItemIndex;
      // const shouldAttachRef =
      //   (modalIndex >= 0 && modalIndex === index) || index === 0;

      return viewType === 'list'
        ? renderListItem(item, index)
        : renderGridItem(
            {
              item,
              index,
              isModalOpen: modalIndex === index,
              moveModal: handleMoveModal,
              ref:
                index === 0
                  ? gridItemRef
                  : modalIndex === index
                  ? selectedModalItemRef
                  : null,
            },
            {
              open: isOpen,
              modalItemGuid: modalGuid,
              modalIndex: modalIndex,
              rowSize: rowSize,
              renderChildren: renderGridItem,
            },
          );
    });
  };

  return (
    <Box sx={{ minHeight: containerHeight }}>
      {showAlphabetFilter && handleAlphaNumFilter && (
        <Box
          sx={{
            position: 'fixed',
            display: 'flex',
            flexDirection: 'column',
            right: [-8, -4],
            zIndex: 1000,
            bottom: {
              xs: 56 + 8,
              md: 'auto',
              // sm: 0,
            },
          }}
        >
          {map(AlphanumericCharCodes, (code) => {
            const str = String.fromCharCode(code);
            return (
              <Button
                disableRipple
                sx={{ py: 0, px: 1, minWidth: '100%' }}
                key={code}
                onClick={() => handleAlphaFilterChange(str)}
                color={alphanumericFilter === str ? 'info' : undefined}
              >
                {str}
              </Button>
            );
          })}
        </Box>
      )}
      <Box ref={gridContainerRef} sx={{ width: '100%' }}>
        {viewType === 'grid' ? (
          <Grid
            container
            component="div"
            spacing={2}
            sx={{
              display: viewType === 'grid' ? 'grid' : 'flex',
              gridTemplateColumns:
                viewType === 'grid'
                  ? 'repeat(auto-fill, minmax(160px, 1fr))'
                  : 'none',
              justifyContent: viewType === 'grid' ? 'space-around' : 'normal',
              mt: 2,
            }}
            ref={ref}
          >
            {renderItems()}
          </Grid>
        ) : (
          <List>{renderItems()}</List>
        )}
      </Box>

      {!isLoading && hasNextPage && (
        <div
          style={{
            height:
              gridItemRef?.current?.getBoundingClientRect()?.height ?? 200,
          }}
          ref={ref}
        ></div>
      )}
      {isFetchingNextPage && (
        <CircularProgress
          color="primary"
          sx={{ display: 'block', margin: '2em auto' }}
        />
      )}
      {data && !hasNextPage && (
        <Typography
          variant="h6"
          fontStyle={'italic'}
          sx={{ textAlign: 'center', mt: 2 }}
        >
          fin.
        </Typography>
      )}
    </Box>
  );
}
