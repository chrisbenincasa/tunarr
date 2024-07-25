import {
  findLastItemInRowIndex,
  getImagesPerRow,
} from '@/helpers/inlineModalUtil.ts';
import useStore from '@/store/index.ts';
import { Box, CircularProgress, Divider, Typography } from '@mui/material';
import { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';
import { usePrevious } from '@uidotdev/usehooks';
import { compact, flatMap, map, sumBy } from 'lodash-es';
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
import { GridContainerTabPanel } from '../GridContainerTabPanel';
import { Nullable } from '@/types/util';
import useDebouncedState from '@/hooks/useDebouncedState';

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
  // modalIndex: number;
  // rowSize: number;
  // viewType: 'grid' | 'list';
  getPageDataSize: (page: PageDataType) => { total?: number; size: number };
  extractItems: (page: PageDataType) => ItemType[];
  renderGridItem: (
    gridItemProps: GridItemProps<ItemType>,
    modalProps: GridInlineModalProps<ItemType>,
  ) => JSX.Element;
  renderListItem: (item: ItemType, index: number) => JSX.Element;
  renderFinalRow?: (modalProps: GridInlineModalProps<ItemType>) => JSX.Element;
  getItemKey: (item: ItemType) => string;
  infiniteQuery: UseInfiniteQueryResult<InfiniteData<PageDataType>>;
};

type RefMap = {
  [k: string]: HTMLDivElement | null;
};

type Size = {
  width?: number;
  height?: number;
};

type ModalState = {
  modalIndex: number;
  modalGuid: Nullable<string>;
};

export function MediaItemGrid<PageDataType, ItemType>({
  // modalIndex,
  getPageDataSize,
  renderGridItem,
  renderListItem,
  renderFinalRow,
  getItemKey,
  extractItems,
  infiniteQuery: {
    data,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    isLoading,
  },
}: Props<PageDataType, ItemType>) {
  const viewType = useStore((state) => state.theme.programmingSelectorView);
  const [scrollParams, setScrollParams] = useState({ limit: 0, max: -1 });
  const [rowSize, setRowSize] = useState(9);
  // const [modalIndex, setModalIndex] = useState(-1);
  // const [modalGuid, setModalGuid] = useState('');
  const [{ modalIndex, modalGuid }, setModalState] = useState<ModalState>({
    modalGuid: null,
    modalIndex: -1,
  });
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const gridImageRefs = useRef<RefMap>({});
  const test = useRef<HTMLDivElement>(null);
  // const [theWidth, setTheWidth] = useState(0);

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

  // We keep the state of a grid image's width by utilizing a ref callback
  // We pass this stable callback function to every
  const [, singleImageWidth, , setSingleImageWidthDebounced] =
    useDebouncedState<number>(-1, 500);
  const updateSingleImageWidthRefCallback = useCallback(
    (el: Nullable<HTMLDivElement>) => {
      console.log('single image width');
      setSingleImageWidthDebounced(el?.getBoundingClientRect()?.width ?? -1);
    },
    [setSingleImageWidthDebounced],
  );

  useEffect(() => {
    if (viewType === 'grid') {
      // let imageRef: HTMLDivElement | null = null;

      // if (!isNonEmptyString(modalGuid)) {
      //   // Grab the first non-null ref for an image
      //   for (const key in gridImageRefs.current) {
      //     if (gridImageRefs.current[key] !== null) {
      //       imageRef = gridImageRefs.current[key];
      //       break;
      //     }
      //   }
      // } else {
      //   imageRef = get(gridImageRefs.current, modalGuid);
      // }

      // 16 is additional padding available in the parent container
      const rowSize = getImagesPerRow(
        width ? width + 16 : 0,
        test.current?.getBoundingClientRect().width ?? 0,
      );
      console.log('rowSize', rowSize);
      setRowSize(rowSize);
      setScrollParams(({ max }) => ({ max, limit: rowSize * 4 }));
    }
  }, [width, viewType, modalGuid, test]);

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

  const { ref } = useIntersectionObserver({
    onChange: (_, entry) => {
      if (entry.isIntersecting) {
        if (scrollParams.limit < scrollParams.max) {
          setScrollParams(({ limit: prevLimit, max }) => ({
            max,
            limit: prevLimit + rowSize * 4,
          }));
        }

        if (hasNextPage && !isFetchingNextPage) {
          fetchNextPage().catch(console.error);
        }
      }
    },
    threshold: 0.5,
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

  const makeSetGridItemRef = useMemo(() => {
    return (item: ItemType) => {
      const key = getItemKey(item);
      return (el: Nullable<HTMLDivElement>) => {
        gridImageRefs.current[key] = el;
      };
    };
  }, [getItemKey, gridImageRefs]);

  const renderItems = () => {
    return map(compact(flatMap(data?.pages, extractItems)), (item, index) => {
      const isOpen = index === lastItemIndex;
      return viewType === 'list'
        ? renderListItem(item, index)
        : renderGridItem(
            {
              item,
              index,
              isModalOpen: modalIndex === index,
              // modalIndex,
              moveModal: handleMoveModal,
              ref: index === 0 ? test : null, //updateSingleImageWidthRefCallback,
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
    <>
      <Box ref={gridContainerRef} sx={{ width: '100%' }}>
        <GridContainerTabPanel index={0} value={0} key="Library">
          {renderItems()}
          {renderFinalRow &&
            renderFinalRow({
              open: false,
              modalItemGuid: modalGuid,
              modalIndex: modalIndex,
              rowSize: rowSize,
              renderChildren: renderGridItem,
            })}
        </GridContainerTabPanel>
      </Box>
      {!isLoading && <div style={{ height: 96 }} ref={ref}></div>}
      {isFetchingNextPage && (
        <CircularProgress
          color="primary"
          sx={{ display: 'block', margin: '2em auto' }}
        />
      )}
      {data && !hasNextPage && (
        <Typography fontStyle={'italic'} sx={{ textAlign: 'center' }}>
          fin.
        </Typography>
      )}
      <Divider sx={{ mt: 3, mb: 2 }} />
    </>
  );
}
