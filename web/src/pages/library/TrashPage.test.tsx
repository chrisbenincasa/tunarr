import { renderWithProviders, screen } from '@/test/utils';
import type { EmptyTrashStatus } from '@tunarr/types/api';
import type { SearchRequest } from '@tunarr/types/schemas';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { TrashPage } from './TrashPage.tsx';

const mocks = vi.hoisted(() => ({
  gridRequests: [] as (SearchRequest | undefined)[],
  emptyTrash: vi.fn(),
  cancel: vi.fn(),
  trash: {
    status: undefined as EmptyTrashStatus | undefined,
    isDraining: false,
    isStarting: false,
    isCancelling: false,
  },
}));

vi.mock('@/components/library/LibraryProgramGrid.tsx', () => ({
  LibraryProgramGrid: ({
    searchRequest,
  }: {
    searchRequest?: SearchRequest;
  }) => {
    mocks.gridRequests.push(searchRequest);
    return <div>grid</div>;
  },
}));

vi.mock('@/hooks/useEmptyTrash.ts', () => ({
  useEmptyTrash: () => ({
    ...mocks.trash,
    emptyTrash: mocks.emptyTrash,
    cancel: mocks.cancel,
  }),
}));

const lastRequest = () => mocks.gridRequests.at(-1);

const trashedFilter = {
  type: 'value',
  fieldSpec: {
    key: 'state',
    name: '',
    op: '=',
    type: 'faceted_string',
    value: ['missing'],
  },
};

const runningStatus = (state: EmptyTrashStatus['state']): EmptyTrashStatus => ({
  state,
  total: 200,
  deleted: 50,
  startedAt: 0,
  finishedAt: null,
  error: null,
});

describe('TrashPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.gridRequests = [];
    mocks.trash = {
      status: undefined,
      isDraining: false,
      isStarting: false,
      isCancelling: false,
    };
  });

  test('shows only trashed items by default', () => {
    renderWithProviders(<TrashPage />);
    expect(lastRequest()).toEqual({ filter: trashedFilter });
  });

  test('narrows the grid to the selected types', async () => {
    const { user } = renderWithProviders(<TrashPage />);
    await user.click(screen.getByRole('button', { name: 'Episodes' }));
    await user.click(screen.getByRole('button', { name: 'Movies' }));

    expect(lastRequest()).toEqual({
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
              value: ['movie', 'episode'],
              type: 'faceted_string',
            },
          },
        ],
      },
    });

    await user.click(screen.getByRole('button', { name: 'All' }));
    expect(lastRequest()).toEqual({ filter: trashedFilter });
  });

  test('starts emptying the trash', async () => {
    const { user } = renderWithProviders(<TrashPage />);
    await user.click(screen.getByRole('button', { name: 'Empty Trash' }));
    expect(mocks.emptyTrash).toHaveBeenCalled();
  });

  test('shows the drain progress and cancels it', async () => {
    mocks.trash = {
      ...mocks.trash,
      status: runningStatus('running'),
      isDraining: true,
    };
    const { user } = renderWithProviders(<TrashPage />);
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '25',
    );
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mocks.cancel).toHaveBeenCalled();
  });

  test('disables Cancel once cancelling', () => {
    mocks.trash = {
      ...mocks.trash,
      status: runningStatus('cancelling'),
      isDraining: true,
      isCancelling: true,
    };
    renderWithProviders(<TrashPage />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  test('disables Empty Trash while the request starts', () => {
    mocks.trash = { ...mocks.trash, isStarting: true };
    renderWithProviders(<TrashPage />);
    expect(screen.getByRole('button', { name: 'Empty Trash' })).toBeDisabled();
  });
});
