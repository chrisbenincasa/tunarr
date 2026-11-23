import { renderWithProviders, screen } from '@/test/utils';
import { describe, expect, test, vi } from 'vitest';
import {
  TrashView,
  type TrashDrain,
  type TrashItemType,
} from './TrashView.tsx';

const renderView = (
  drain: TrashDrain = { state: 'idle' },
  selectedTypes: TrashItemType[] = [],
) => {
  const onTypesChange = vi.fn();
  const onEmptyTrash = vi.fn();
  const onCancel = vi.fn();
  const result = renderWithProviders(
    <TrashView
      selectedTypes={selectedTypes}
      onTypesChange={onTypesChange}
      drain={drain}
      onEmptyTrash={onEmptyTrash}
      onCancel={onCancel}
    >
      <div>grid</div>
    </TrashView>,
  );
  return { ...result, onTypesChange, onEmptyTrash, onCancel };
};

const textIs = (text: string) => (_: string, el: Element | null) =>
  el?.tagName === 'P' && el.textContent === text;

describe('TrashView type filter', () => {
  test('adds a type in option order', async () => {
    const { user, onTypesChange } = renderView({ state: 'idle' }, ['track']);
    await user.click(screen.getByRole('button', { name: 'Movies' }));
    expect(onTypesChange).toHaveBeenCalledWith(['movie', 'track']);
  });

  test('removes a selected type', async () => {
    const { user, onTypesChange } = renderView({ state: 'idle' }, [
      'movie',
      'episode',
    ]);
    await user.click(screen.getByRole('button', { name: 'Movies' }));
    expect(onTypesChange).toHaveBeenCalledWith(['episode']);
  });

  test('All clears the selection', async () => {
    const { user, onTypesChange } = renderView({ state: 'idle' }, ['movie']);
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await user.click(screen.getByRole('button', { name: 'All' }));
    expect(onTypesChange).toHaveBeenCalledWith([]);
  });

  test('marks the selected types as pressed', () => {
    renderView({ state: 'idle' }, ['music_video']);
    expect(
      screen.getByRole('button', { name: 'Music Videos' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Episodes' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});

describe('TrashView empty trash', () => {
  test('starts emptying from the header when idle', async () => {
    const { user, onEmptyTrash } = renderView();
    await user.click(screen.getByRole('button', { name: 'Empty Trash' }));
    expect(onEmptyTrash).toHaveBeenCalled();
    expect(
      screen.queryByRole('button', { name: 'Cancel' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  test('disables Empty Trash while the request starts', () => {
    renderView({ state: 'starting' });
    expect(screen.getByRole('button', { name: 'Empty Trash' })).toBeDisabled();
  });

  test('shows progress and an enabled Cancel while draining', async () => {
    const { user, onCancel } = renderView({
      state: 'running',
      deleted: 25,
      total: 100,
    });
    expect(screen.getByRole('button', { name: 'Empty Trash' })).toBeDisabled();
    expect(screen.getByText(textIs('Emptying trash: 25 / 100'))).toBeVisible();
    expect(
      screen.getByRole('progressbar', { name: 'Empty trash progress' }),
    ).toHaveAttribute('aria-valuenow', '25');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });

  test('disables Cancel while cancelling', () => {
    renderView({ state: 'cancelling', deleted: 40, total: 50 });
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Empty Trash' })).toBeDisabled();
    expect(
      screen.getByText(textIs('Cancelling: 40 / 50 removed')),
    ).toBeVisible();
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '80',
    );
  });

  test('shows zero progress when the total is zero', () => {
    renderView({ state: 'running', deleted: 0, total: 0 });
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '0',
    );
  });
});
