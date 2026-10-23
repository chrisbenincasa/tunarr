import { renderWithProviders, screen } from '@/test/utils';
import { describe, expect, test, vi } from 'vitest';
import { Segmented } from './Segmented.tsx';

const options = [
  { value: 'all', label: 'All' },
  { value: 'streaming', label: 'Streaming' },
  { value: 'stealth', label: 'Stealth', disabled: true },
] as const;

describe('Segmented', () => {
  test('marks only the selected option as pressed', () => {
    renderWithProviders(
      <Segmented
        options={options}
        value="streaming"
        onChange={() => {}}
        aria-label="Status filter"
      />,
    );

    expect(screen.getByRole('group', { name: 'Status filter' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Streaming' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  test('emits the clicked option value', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <Segmented
        options={options}
        value="all"
        onChange={onChange}
        aria-label="Status filter"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Streaming' }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith('streaming');
  });

  test('clicking the selected option does not clear the selection', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <Segmented
        options={options}
        value="all"
        onChange={onChange}
        aria-label="Status filter"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'All' }));

    expect(onChange).not.toHaveBeenCalled();
  });

  test('disabled options cannot be picked', () => {
    renderWithProviders(
      <Segmented
        options={options}
        value="all"
        onChange={() => {}}
        aria-label="Status filter"
      />,
    );

    expect(screen.getByRole('button', { name: 'Stealth' })).toBeDisabled();
  });
});
