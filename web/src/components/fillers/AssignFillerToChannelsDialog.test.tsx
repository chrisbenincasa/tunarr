import { renderWithProviders, screen } from '@/test/utils';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type * as Sdk from '../../generated/sdk.gen.ts';
import type * as BulkAssignHooks from '../../hooks/useBulkAssignFillers.tsx';
import { makeStoryChannel } from '../channels/channelStoryFixtures.ts';
import { AssignFillerToChannelsDialog } from './AssignFillerToChannelsDialog.tsx';

const mutate = vi.hoisted(() => vi.fn());
const getChannels = vi.hoisted(() => vi.fn());

vi.mock('../../hooks/useBulkAssignFillers.tsx', async (importOriginal) => ({
  ...(await importOriginal<typeof BulkAssignHooks>()),
  useBulkAssignFillers: () => ({ mutate, isPending: false }),
}));

vi.mock('../../generated/sdk.gen.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof Sdk>()),
  getChannels,
}));

const channels = [
  makeStoryChannel({ id: 'channel-1', number: 1, name: 'Cartoons' }),
  makeStoryChannel({ id: 'channel-2', number: 2, name: 'Sitcoms' }),
  makeStoryChannel({ id: 'channel-3', number: 3, name: 'Movies' }),
];

const renderDialog = () =>
  renderWithProviders(
    <AssignFillerToChannelsDialog
      open
      onClose={() => {}}
      fillerId="filler-a"
      fillerName="Bumpers"
    />,
  );

beforeEach(() => {
  mutate.mockReset();
  getChannels.mockReset();
});

describe('AssignFillerToChannelsDialog', () => {
  test('adds the filler list to the selected channels', async () => {
    getChannels.mockResolvedValue({ data: channels });
    const { user } = renderDialog();

    await user.click(await screen.findByText('1. Cartoons'));
    await user.click(screen.getByText('3. Movies'));
    const cooldown = screen.getByLabelText('Cooldown (s)');
    await user.clear(cooldown);
    await user.type(cooldown, '90');

    await user.click(screen.getByRole('button', { name: /Apply to/ }));

    expect(mutate).toHaveBeenCalledWith({
      body: {
        channelIds: ['channel-1', 'channel-3'],
        fillers: [
          { fillerShowId: 'filler-a', weight: 50, cooldownSeconds: 90 },
        ],
        mode: 'add',
      },
    });
  });

  test('Select All toggles every channel', async () => {
    getChannels.mockResolvedValue({ data: channels });
    const { user } = renderDialog();

    await user.click(await screen.findByRole('button', { name: 'Select All' }));
    expect(
      screen.getByRole('button', { name: /Apply to 3 channels/ }),
    ).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Deselect All' }));
    expect(screen.getByRole('button', { name: /Apply to/ })).toBeDisabled();
  });

  test('shows a retryable error when the channels fail to load', async () => {
    getChannels
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ data: channels });
    const { user } = renderDialog();

    expect(
      await screen.findByText('Failed to load channels.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/No channels found/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('1. Cartoons')).toBeInTheDocument();
  });
});
