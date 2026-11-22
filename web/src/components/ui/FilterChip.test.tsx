import { renderWithProviders, screen } from '@/test/utils';
import { describe, expect, test, vi } from 'vitest';
import { FilterChip } from './FilterChip.tsx';

describe('FilterChip', () => {
  test('reports its selected state through aria-pressed', () => {
    renderWithProviders(
      <>
        <FilterChip label="Movies" selected onClick={() => {}} />
        <FilterChip label="Episodes" selected={false} onClick={() => {}} />
      </>,
    );

    expect(screen.getByRole('button', { name: 'Movies' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Episodes' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  test('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    const { user } = renderWithProviders(
      <FilterChip label="Movies" selected={false} onClick={onClick} />,
    );

    await user.click(screen.getByRole('button', { name: 'Movies' }));

    expect(onClick).toHaveBeenCalledOnce();
  });
});
