import useStore from '@/store';
import { useSelectedMedia } from '@/store/programmingSelector/selectors';
import { MediaSourceSettings } from '@tunarr/types';
import { MediaSourceId } from '@tunarr/types/schemas';
import { flatMap, flatMapDeep, isEmpty, some } from 'lodash-es';

export const useIsSelected = (
  mediaSourceId: MediaSourceId,
  itemSource: MediaSourceSettings['type'],
  id: string,
) => {
  const contentHierarchy = useStore(
    (s) => s.contentHierarchyByServer[mediaSourceId] ?? {},
  );
  const selectedMedia = useSelectedMedia(itemSource) ?? [];

  const enumerateHierarchy = (thisId: string, acc: string[] = []): string[] => {
    const hierarchy = contentHierarchy[thisId] ?? [];
    if (isEmpty(hierarchy)) {
      return [thisId];
    }

    return flatMapDeep(hierarchy, (id) =>
      enumerateHierarchy(id, [...acc, ...hierarchy]),
    );
  };

  const selectedChildren = flatMap(selectedMedia, (sm) =>
    enumerateHierarchy(sm.id),
  );

  return (
    some(selectedMedia, (sm) => sm.type === itemSource && sm.id === id) ||
    selectedChildren.includes(id)
  );
};
