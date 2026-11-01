import { renderWithProviders, screen } from '@/test/utils';
import { describe, expect, test } from 'vitest';
import { ActionsHeader } from './ActionsHeader.tsx';

describe('ActionsHeader', () => {
  test('hides its label in a 1px box', () => {
    renderWithProviders(<ActionsHeader />);
    const label = getComputedStyle(screen.getByText('Actions'));
    expect(label.width).toBe('1px');
    expect(label.height).toBe('1px');
  });
});
