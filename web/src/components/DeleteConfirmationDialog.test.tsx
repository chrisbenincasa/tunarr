import { describe, expect, test, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';

describe('DeleteConfirmationDialog', () => {
  test('renders title and body', () => {
    renderWithProviders(
      <DeleteConfirmationDialog
        open={true}
        title="Delete Item"
        body="Are you sure you want to delete this item?"
        onConfirm={() => {}}
        onClose={() => {}}
      />,
    );

    expect(screen.getByText('Delete Item')).toBeInTheDocument();
    expect(
      screen.getByText('Are you sure you want to delete this item?'),
    ).toBeInTheDocument();
  });

  test('delete button calls onConfirm then onClose', async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    const { user } = renderWithProviders(
      <DeleteConfirmationDialog
        open={true}
        title="Confirm Delete"
        body="This action cannot be undone."
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );

    const deleteButton = screen.getByRole('button', { name: 'Delete' });
    await user.click(deleteButton);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    // onConfirm should be called before onClose
    expect(onConfirm.mock.invocationCallOrder[0]).toBeLessThan(
      onClose.mock.invocationCallOrder[0],
    );
  });

  test('cancel button calls onCancel (if provided) then onClose', async () => {
    const onCancel = vi.fn();
    const onClose = vi.fn();

    const { user } = renderWithProviders(
      <DeleteConfirmationDialog
        open={true}
        title="Confirm Delete"
        onConfirm={() => {}}
        onCancel={onCancel}
        onClose={onClose}
      />,
    );

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelButton);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('cancel button only calls onClose when onCancel not provided', async () => {
    const onClose = vi.fn();

    const { user } = renderWithProviders(
      <DeleteConfirmationDialog
        open={true}
        title="Confirm Delete"
        onConfirm={() => {}}
        onClose={onClose}
      />,
    );

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('body is optional - does not render DialogContent if missing', () => {
    renderWithProviders(
      <DeleteConfirmationDialog
        open={true}
        title="Delete Without Body"
        onConfirm={() => {}}
        onClose={() => {}}
      />,
    );

    expect(screen.getByText('Delete Without Body')).toBeInTheDocument();
    // Should have title and buttons but no body content
    expect(screen.queryByRole('paragraph')).not.toBeInTheDocument();
  });

  test('does not render when open is false', () => {
    renderWithProviders(
      <DeleteConfirmationDialog
        open={false}
        title="Hidden Dialog"
        body="Should not be visible"
        onConfirm={() => {}}
        onClose={() => {}}
      />,
    );

    expect(screen.queryByText('Hidden Dialog')).not.toBeInTheDocument();
  });

  test('passes dialogProps to Dialog component', () => {
    renderWithProviders(
      <DeleteConfirmationDialog
        open={true}
        title="With Props"
        onConfirm={() => {}}
        onClose={() => {}}
        dialogProps={{ maxWidth: 'sm', fullWidth: true }}
      />,
    );

    expect(screen.getByText('With Props')).toBeInTheDocument();
  });
});
