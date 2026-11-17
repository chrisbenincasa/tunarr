import { renderWithProviders, screen } from '@/test/utils';
import { QueryClient } from '@tanstack/react-query';
import type { FillerList } from '@tunarr/types';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type * as Sdk from '../../generated/sdk.gen.ts';
import type * as BulkAssignHooks from '../../hooks/useBulkAssignFillers.tsx';
import { fillerListsQuery } from '../../hooks/useFillerLists.ts';
import { BulkAssignFillersDialog } from './BulkAssignFillersDialog.tsx';

const mutate = vi.hoisted(() => vi.fn());
const getApiFillerLists = vi.hoisted(() => vi.fn());

vi.mock('../../generated/sdk.gen.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof Sdk>()),
  getApiFillerLists,
}));

vi.mock('../../hooks/useBulkAssignFillers.tsx', async (importOriginal) => ({
  ...(await importOriginal<typeof BulkAssignHooks>()),
  useBulkAssignFillers: () => ({ mutate, isPending: false }),
}));

const fillerLists: FillerList[] = [
  { id: 'filler-a', name: 'Bumpers', contentCount: 3 },
  { id: 'filler-b', name: 'Trailers', contentCount: 5 },
  { id: 'filler-c', name: 'Station IDs', contentCount: 2 },
];

const renderDialog = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(fillerListsQuery().queryKey, fillerLists);
  return renderWithProviders(
    <BulkAssignFillersDialog
      open
      onClose={() => {}}
      selectedChannelIds={['channel-1', 'channel-2']}
    />,
    { queryClient },
  );
};

beforeEach(() => {
  mutate.mockReset();
  getApiFillerLists.mockReset();
});

describe('BulkAssignFillersDialog', () => {
  test('sends the selected lists with their edited settings', async () => {
    const { user } = renderDialog();

    await user.click(screen.getByText('Bumpers'));
    await user.click(screen.getByText('Trailers'));
    await user.click(screen.getByText('Station IDs'));
    await user.click(screen.getByText('Trailers'));

    const [bumpersCooldown] = screen.getAllByLabelText('Cooldown (s)');
    if (!bumpersCooldown) {
      throw new Error('Expected a cooldown field for Bumpers');
    }
    await user.clear(bumpersCooldown);
    await user.type(bumpersCooldown, '90');

    await user.click(screen.getByRole('button', { name: /Apply to/ }));

    expect(mutate).toHaveBeenCalledWith({
      body: {
        channelIds: ['channel-1', 'channel-2'],
        fillers: [
          { fillerShowId: 'filler-a', weight: 50, cooldownSeconds: 90 },
          { fillerShowId: 'filler-c', weight: 50, cooldownSeconds: 30 },
        ],
        mode: 'add',
      },
    });
  });

  test('disables Apply until a list is selected', async () => {
    const { user } = renderDialog();
    const apply = screen.getByRole('button', { name: /Apply to/ });
    expect(apply).toBeDisabled();

    await user.click(screen.getByText('Bumpers'));
    expect(apply).toBeEnabled();

    await user.click(screen.getByText('Bumpers'));
    expect(apply).toBeDisabled();
  });

  test('shows a retryable error when the filler lists fail to load', async () => {
    getApiFillerLists
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ data: fillerLists });
    const { user } = renderWithProviders(
      <BulkAssignFillersDialog
        open
        onClose={() => {}}
        selectedChannelIds={['channel-1']}
      />,
    );

    expect(
      await screen.findByText('Failed to load filler lists.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/No filler lists found/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Bumpers')).toBeInTheDocument();
  });
});
