import { renderWithProviders, screen } from '@/test/utils';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ChannelProgrammingFlexTools } from './ChannelProgrammingFlexTools';

const mockRemoveFlex = vi.fn();

vi.mock('../../hooks/programming_controls/useRemoveFlex', () => ({
  useRemoveFlex: () => mockRemoveFlex,
}));

describe('ChannelProgrammingFlexTools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('opens a menu with every bulk flex tool', async () => {
    renderWithProviders(<ChannelProgrammingFlexTools />);

    await userEvent.click(screen.getByRole('button', { name: 'Flex' }));

    const items = screen
      .getAllByRole('menuitem')
      .map((item) => item.textContent?.trim());
    expect(items).toEqual([
      'Add Breaks...',
      'Pad Start Times...',
      'Restrict Hours...',
      'Remove All Flex',
    ]);
  });

  test('removes all flex from the menu', async () => {
    renderWithProviders(<ChannelProgrammingFlexTools />);

    await userEvent.click(screen.getByRole('button', { name: 'Flex' }));
    await userEvent.click(screen.getByText('Remove All Flex'));

    expect(mockRemoveFlex).toHaveBeenCalledOnce();
  });
});
