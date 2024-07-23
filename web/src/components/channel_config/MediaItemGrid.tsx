import { InfiniteData } from '@tanstack/react-query';
import { compact, flatMap, map } from 'lodash-es';

type Props<PageDataType, ItemType> = {
  modalIndex: number;
  rowSize: number;
  data: InfiniteData<PageDataType>;
  viewType: 'grid' | 'list';
  getPageDataSize: (page: PageDataType) => number;
  extractItems: (page: PageDataType) => ItemType[];
  renderGridItem: (item: ItemType, index: number) => JSX.Element;
  renderListItem: (item: ItemType, index: number) => JSX.Element;
};

export function MediaItemGrid<PageDataType, ItemType>({
  modalIndex,
  data,
  getPageDataSize,
  viewType,
  renderGridItem,
  renderListItem,
  extractItems,
}: Props<PageDataType, ItemType>) {
  // const [rowSize, setRowSize] = useState(9);
  // const firstItemInNextRowIndex = useMemo(
  //   () =>
  //     findFirstItemInNextRowIndex(
  //       modalIndex,
  //       rowSize,
  //       sumBy(data?.pages, getPageDataSize) ?? 0,
  //     ),
  //   [modalIndex, rowSize, data?.pages, getPageDataSize],
  // );

  const renderItems = () => {
    return map(compact(flatMap(data.pages, extractItems)), (item, index) =>
      viewType === 'list'
        ? renderListItem(item, index)
        : renderGridItem(item, index),
    );
  };

  return <>{renderItems()}</>;
}
