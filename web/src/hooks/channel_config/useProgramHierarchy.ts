import { last, slice } from 'lodash-es';
import { useCallback, useState } from 'react';

export interface ProgramHierarchyHookReturn<ItemType> {
  pushParentContext: (item: ItemType) => void;
  clearParentContext: () => void;
  popParentContextToIndex: (idx: number) => void;
  parentContext: ItemType[];
}

export const useProgramHierarchy = <ItemType>(
  itemIdExtractor: (item: ItemType) => string,
): ProgramHierarchyHookReturn<ItemType> => {
  const [parentContext, setParentContext] = useState<ItemType[]>([]);

  const pushParentContext = useCallback(
    (item: ItemType) => {
      setParentContext((prev) => {
        const lastItem = last(prev);
        if (!lastItem || itemIdExtractor(lastItem) !== itemIdExtractor(item)) {
          return [...prev, item];
        } else {
          return prev;
        }
      });
    },
    [itemIdExtractor],
  );

  const clearParentContext = () => {
    setParentContext([]);
  };

  const popParentContextToIndex = (idx: number) => {
    setParentContext((prev) => slice(prev, 0, idx + 1));
  };

  return {
    parentContext,
    pushParentContext,
    clearParentContext,
    popParentContextToIndex,
  };
};
