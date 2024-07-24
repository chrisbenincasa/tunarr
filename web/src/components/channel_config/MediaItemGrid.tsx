import {
  findFirstItemInNextRowIndex,
  getImagesPerRow,
} from '@/helpers/inlineModalUtil.ts';
import useStore from '@/store/index.ts';
import { Box, CircularProgress, Divider, Typography } from '@mui/material';
import { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';
import { usePrevious } from '@uidotdev/usehooks';
import { compact, flatMap, get, isEmpty, map, sumBy } from 'lodash-es';
import {
  ForwardedRef,
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
import { GridContainerTabPanel } from '../GridContainerTabPanel';
import { InlineModal } from '../InlineModal.tsx';

type GridItemProps<ItemType> = {
  item: ItemType;
  index: number;
  modalIndex: number;
  moveModal: (index: number, item: ItemType) => void;
  ref: ForwardedRef<HTMLDivElement>;
};

type Props<PageDataType, ItemType> = {
  // modalIndex: number;
  // rowSize: number;
  // viewType: 'grid' | 'list';
  getPageDataSize: (page: PageDataType) => { total?: number; size: number };
  extractItems: (page: PageDataType) => ItemType[];
  renderGridItem: (props: GridItemProps<ItemType>) => JSX.Element;
  renderListItem: (item: ItemType, index: number) => JSX.Element;
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

export function MediaItemGrid<PageDataType, ItemType>({
  // modalIndex,
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
}: Props<PageDataType, ItemType>) {
  const viewType = useStore((state) => state.theme.programmingSelectorView);
  const [scrollParams, setScrollParams] = useState({ limit: 0, max: -1 });
  const [rowSize, setRowSize] = useState(9);
  const [modalIndex, setModalIndex] = useState(-1);
  const [modalGuid, setModalGuid] = useState('');
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const gridImageRefs = useRef<RefMap>({});
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
      let imageRef: HTMLDivElement | null = null;

      if (isEmpty(modalGuid)) {
        // Grab the first non-null ref for an image
        for (const key in gridImageRefs.current) {
          if (gridImageRefs.current[key] !== null) {
            imageRef = gridImageRefs.current[key];
            break;
          }
        }
      } else {
        imageRef = get(gridImageRefs.current, modalGuid);
      }

      const imageWidth = imageRef?.getBoundingClientRect().width;

      // 16 is additional padding available in the parent container
      const rowSize = getImagesPerRow(width ? width + 16 : 0, imageWidth ?? 0);
      setRowSize(rowSize);
      setScrollParams(({ max }) => ({ max, limit: rowSize * 4 }));
    }
  }, [width, viewType, modalGuid]);

  const handleMoveModal = useCallback(
    (index: number, item: ItemType) => {
      if (index === modalIndex) {
        setModalIndex(-1);
        setModalGuid('');
      } else {
        setModalIndex(index);
        setModalGuid(getItemKey(item));
      }
    },
    [modalIndex, getItemKey],
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

  useEffect(() => {
    if (viewType === 'grid') {
      let imageRef: HTMLDivElement | null = null;

      if (modalGuid === '') {
        // Grab the first non-null ref for an image
        for (const key in gridImageRefs.current) {
          if (gridImageRefs.current[key] !== null) {
            imageRef = gridImageRefs.current[key];
            break;
          }
        }
      } else {
        imageRef = get(gridImageRefs.current, modalGuid);
      }

      const imageWidth = imageRef?.getBoundingClientRect().width;

      // 16 is additional padding available in the parent container
      const rowSize = getImagesPerRow(width ? width + 16 : 0, imageWidth ?? 0);
      setRowSize(rowSize);
      setScrollParams(({ max }) => ({ max, limit: rowSize * 4 }));
    }
  }, [width, viewType, modalGuid]);

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

  const firstItemIndex = useMemo(
    () =>
      findFirstItemInNextRowIndex(
        modalIndex,
        rowSize,
        sumBy(data?.pages, (page) => getPageDataSize(page).size) ?? 0,
      ),
    [modalIndex, rowSize, data?.pages, getPageDataSize],
  );

  const renderItems = () => {
    return map(compact(flatMap(data?.pages, extractItems)), (item, index) => {
      const isOpen = index === firstItemIndex;
      return viewType === 'list' ? (
        renderListItem(item, index)
      ) : (
        <Fragment key={getItemKey(item)}>
          <InlineModal
            itemGuid={modalGuid}
            modalIndex={modalIndex}
            rowSize={rowSize}
            open={isOpen}
            type={'season'}
          />
          {renderGridItem({
            item,
            index,
            modalIndex,
            moveModal: () => handleMoveModal(index, item),
            ref: (element) =>
              (gridImageRefs.current[getItemKey(item)] = element),
          })}
        </Fragment>
      );
    });
  };

  return (
    <>
      <Box ref={gridContainerRef} sx={{ width: '100%' }}>
        <GridContainerTabPanel index={0} value={0} key="Library">
          {renderItems()}
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
