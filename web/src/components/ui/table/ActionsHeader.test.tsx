import { renderWithProviders, screen } from '@/test/utils';
import { describe, expect, test } from 'vitest';
import { ActionsHeader } from './ActionsHeader.tsx';

describe('ActionsHeader', () => {
  // sx reads a bare 1 as 100%, which made the hidden label as wide as the
  // page and scrolled every DataTable page sideways.
  test('hides its label in a 1px box', () => {
    renderWithProviders(<ActionsHeader />);
    const label = getComputedStyle(screen.getByText('Actions'));
    expect(label.width).toBe('1px');
    expect(label.height).toBe('1px');
  });
});
