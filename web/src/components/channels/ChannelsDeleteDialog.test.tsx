import { renderWithProviders, screen, userEvent } from '@/test/utils';
import { describe, expect, test, vi } from 'vitest';
import { ChannelsDeleteDialog } from './ChannelsDeleteDialog.tsx';

const channels = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `channel-${i + 1}`,
    name: `Channel ${i + 1}`,
  }));

describe('ChannelsDeleteDialog', () => {
  test('stays closed without channels', () => {
    renderWithProviders(
      <ChannelsDeleteDialog
        channels={null}
        onConfirm={() => {}}
        onClose={() => {}}
      />,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('lists every name for a short selection', () => {
    renderWithProviders(
      <ChannelsDeleteDialog
        channels={channels(2)}
        onConfirm={() => {}}
        onClose={() => {}}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Delete 2 channels?' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(
      ['Channel 1', 'Channel 2'],
    );
  });

  test('shows five names and counts the rest', () => {
    renderWithProviders(
      <ChannelsDeleteDialog
        channels={channels(8)}
        onConfirm={() => {}}
        onClose={() => {}}
      />,
    );

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(6);
    expect(items.at(-1)).toHaveTextContent('and 3 more');
    expect(screen.queryByText('Channel 6')).not.toBeInTheDocument();
  });

  test('calls back on cancel and confirm', async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    renderWithProviders(
      <ChannelsDeleteDialog
        channels={channels(1)}
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
