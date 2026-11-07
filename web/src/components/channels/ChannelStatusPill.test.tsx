import { renderWithProviders, screen } from '@/test/utils';
import { describe, expect, test, vi } from 'vitest';
import { ChannelStatusPill } from './ChannelStatusPill.tsx';

describe('ChannelStatusPill', () => {
  test('names the sessions button after the status it shows', async () => {
    const onOpenSessions = vi.fn();
    const { user } = renderWithProviders(
      <ChannelStatusPill
        status={{ status: 'live', connections: 2, sessions: 1 }}
        onOpenSessions={onOpenSessions}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: '2 watching, show sessions' }),
    );

    expect(onOpenSessions).toHaveBeenCalledOnce();
  });

  test('is not a button without sessions', () => {
    renderWithProviders(
      <ChannelStatusPill
        status={{ status: 'idle', connections: 0, sessions: 0 }}
        onOpenSessions={() => {}}
      />,
    );

    expect(screen.getByText('Idle')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
