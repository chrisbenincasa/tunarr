import type { EmptyTrashStatus } from '@tunarr/types/api';
import type { SearchFilter, SearchRequest } from '@tunarr/types/schemas';
import { useMemo, useState } from 'react';
import { LibraryProgramGrid } from '../../components/library/LibraryProgramGrid.tsx';
import {
  TrashView,
  type TrashDrain,
  type TrashItemType,
} from '../../components/library/TrashView.tsx';
import { useEmptyTrash } from '../../hooks/useEmptyTrash.ts';

const toDrain = (
  status: EmptyTrashStatus | undefined,
  isDraining: boolean,
  isStarting: boolean,
  isCancelling: boolean,
): TrashDrain => {
  if (status && isDraining) {
    return {
      state: isCancelling ? 'cancelling' : 'running',
      deleted: status.deleted,
      total: status.total,
    };
  }
  return isStarting ? { state: 'starting' } : { state: 'idle' };
};

export const TrashPage = () => {
  const [itemTypes, setItemTypes] = useState<TrashItemType[]>([]);
  const { status, isDraining, emptyTrash, isStarting, cancel, isCancelling } =
    useEmptyTrash();

  const request = useMemo<SearchRequest>(() => {
    const trashedFilter = {
      type: 'value',
      fieldSpec: {
        key: 'state',
        name: '',
        op: '=',
        type: 'faceted_string',
        value: ['missing'],
      },
    } satisfies SearchFilter;

    if (itemTypes.length === 0) {
      return { filter: trashedFilter };
    }

    return {
      filter: {
        op: 'and',
        type: 'op',
        children: [
          trashedFilter,
          {
            type: 'value',
            fieldSpec: {
              key: 'type',
              name: '',
              op: 'in',
              value: itemTypes,
              type: 'faceted_string',
            },
          },
        ],
      },
    };
  }, [itemTypes]);

  return (
    <TrashView
      selectedTypes={itemTypes}
      onTypesChange={setItemTypes}
      drain={toDrain(status, isDraining, isStarting, isCancelling)}
      onEmptyTrash={emptyTrash}
      onCancel={cancel}
    >
      <LibraryProgramGrid searchRequest={request} />
    </TrashView>
  );
};
