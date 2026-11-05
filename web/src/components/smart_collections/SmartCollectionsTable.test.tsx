import { getApiSmartCollectionsQueryKey } from '@/generated/@tanstack/react-query.gen.ts';
import type * as Gen from '@/generated/@tanstack/react-query.gen.ts';
import useStore from '@/store/index.ts';
import { navigateMock } from '@/test/routerMock.tsx';
import {
  renderWithProviders,
  screen,
  seededQueryClient,
  waitFor,
  within,
  withinRow,
} from '@/test/utils';
import type { SmartCollection } from '@tunarr/types';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { SmartCollectionsTable } from './SmartCollectionsTable.tsx';

const mocks = vi.hoisted(() => ({ remove: vi.fn() }));

vi.mock('@tanstack/react-router', () => import('@/test/routerMock.tsx'));

vi.mock('@/routes/__root.tsx', async () => {
  const { useNavigate } = await import('@/test/routerMock.tsx');
  return { Route: { useNavigate } };
});

vi.mock('@/components/smart_collections/EditSmartCollectionDialog.tsx', () => ({
  EditSmartCollectionDialog: ({ id }: { id: string }) => (
    <div>Editing {id}</div>
  ),
}));

vi.mock('@/generated/@tanstack/react-query.gen.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof Gen>()),
  deleteApiSmartCollectionsByIdMutation: () => ({
    mutationFn: (vars: unknown) => Promise.resolve(mocks.remove(vars)),
  }),
}));

const collections: SmartCollection[] = [
  { uuid: 'uuid-action', name: 'Action Movies', keywords: '' },
  { uuid: 'uuid-cartoons', name: 'Cartoons', keywords: '' },
];

const renderTable = (data: SmartCollection[] = collections) =>
  renderWithProviders(<SmartCollectionsTable />, {
    queryClient: seededQueryClient([[getApiSmartCollectionsQueryKey(), data]]),
  });

describe('SmartCollectionsTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState(({ settings }) => {
      settings.ui.tableSettings = {};
    });
  });

  test('opens the collection in the clicked row', async () => {
    const { user } = renderTable();
    await user.click(
      withinRow('Cartoons').getByRole('button', { name: 'View Collection' }),
    );
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/library/smart_collections/$id',
      params: { id: 'uuid-cartoons' },
    });
  });

  test('edits the collection in the clicked row', async () => {
    const { user } = renderTable();
    await user.click(
      withinRow('Action Movies').getByRole('button', { name: 'Edit' }),
    );
    expect(screen.getByText('Editing uuid-action')).toBeInTheDocument();
  });

  test('deletes a collection only after confirmation', async () => {
    const { user } = renderTable();
    await user.click(
      withinRow('Cartoons').getByRole('button', { name: 'Delete' }),
    );
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Delete "Cartoons"')).toBeInTheDocument();
    expect(mocks.remove).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(mocks.remove).toHaveBeenCalledWith({
        path: { id: 'uuid-cartoons' },
      }),
    );
  });

  test('explains how to create one when there are none', () => {
    renderTable([]);
    expect(
      screen.getByText(/You have no smart collections/),
    ).toBeInTheDocument();
  });
});
