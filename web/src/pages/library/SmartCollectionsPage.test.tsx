import { getApiSmartCollectionsQueryKey } from '@/generated/@tanstack/react-query.gen.ts';
import type * as Gen from '@/generated/@tanstack/react-query.gen.ts';
import useStore from '@/store/index.ts';
import {
  renderWithProviders,
  screen,
  seededQueryClient,
  waitFor,
  within,
} from '@/test/utils';
import type { SmartCollection } from '@tunarr/types';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import SmartCollectionsPage from './SmartCollectionsPage.tsx';

const mocks = vi.hoisted(() => ({ remove: vi.fn() }));

vi.mock('@tanstack/react-router', () => import('@/test/routerMock.tsx'));

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
  { uuid: 'uuid-cartoons', name: 'Cartoons', keywords: '' },
];

const renderPage = () =>
  renderWithProviders(<SmartCollectionsPage />, {
    queryClient: seededQueryClient([
      [getApiSmartCollectionsQueryKey(), collections],
    ]),
  });

describe('SmartCollectionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState(({ settings }) => {
      settings.ui.tableSettings = {};
    });
  });

  test('renders the stored collections and links Create to search', () => {
    renderPage();
    expect(
      screen.getByRole('article', { name: 'Cartoons' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create' })).toHaveAttribute(
      'href',
      '/search',
    );
  });

  test('opens the edit dialog for the chosen collection', async () => {
    const { user } = renderPage();
    await user.click(screen.getByRole('button', { name: 'Edit Cartoons' }));
    expect(screen.getByText('Editing uuid-cartoons')).toBeInTheDocument();
  });

  test('deletes the confirmed collection through the API', async () => {
    const { user } = renderPage();
    await user.click(screen.getByRole('button', { name: 'Delete Cartoons' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete',
      }),
    );
    await waitFor(() =>
      expect(mocks.remove).toHaveBeenCalledWith({
        path: { id: 'uuid-cartoons' },
      }),
    );
  });
});
