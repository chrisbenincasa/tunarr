import { renderWithProviders, screen } from '@/test/utils';
import type * as Router from '@tanstack/react-router';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import AddProgrammingButton from './AddProgrammingButton';

const mockNavigate = vi.fn();

vi.mock('@/routes/channels_/$channelId/programming/index.tsx', () => ({
  Route: { useParams: () => ({ channelId: 'channel-1' }) },
}));

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof Router>()),
  useNavigate: () => mockNavigate,
}));

describe('AddProgrammingButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('opens the menu without performing an action', async () => {
    renderWithProviders(<AddProgrammingButton />);

    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    const items = screen
      .getAllByRole('menuitem')
      .map((item) => item.textContent?.trim());
    expect(items).toEqual(['Media...', 'Redirect...', 'Flex Slot...']);
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('Media navigates to the add programming page', async () => {
    renderWithProviders(<AddProgrammingButton />);

    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    await userEvent.click(screen.getByText('Media...'));

    expect(mockNavigate).toHaveBeenCalledExactlyOnceWith({
      to: '/channels/$channelId/programming/add',
      params: { channelId: 'channel-1' },
    });
  });

  test('Redirect opens the redirect dialog', async () => {
    renderWithProviders(<AddProgrammingButton />);

    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    await userEvent.click(screen.getByText('Redirect...'));

    expect(await screen.findByText('Add Channel Redirect')).toBeInTheDocument();
  });

  test('Flex Slot opens the flex dialog', async () => {
    renderWithProviders(<AddProgrammingButton />);

    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    await userEvent.click(screen.getByText('Flex Slot...'));

    expect(await screen.findByText('Add Flex Time')).toBeInTheDocument();
  });
});
