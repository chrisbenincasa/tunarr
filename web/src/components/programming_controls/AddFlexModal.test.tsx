import { describe, expect, test, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';
import AddFlexModal from './AddFlexModal';
import type { UIFlexProgram } from '@/types/index';

// Mock the store actions
const mockAddProgramsToCurrentChannel = vi.fn();
const mockSetProgramAtIndex = vi.fn();

vi.mock('../../store/channelEditor/actions.ts', () => ({
  addProgramsToCurrentChannel: (programs: unknown) =>
    mockAddProgramsToCurrentChannel(programs),
  setProgramAtIndex: (program: unknown, index: number) =>
    mockSetProgramAtIndex(program, index),
}));

describe('AddFlexModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('shows "Add Flex Time" title when no initialProgram', () => {
    renderWithProviders(<AddFlexModal open={true} onClose={() => {}} />);

    expect(screen.getByText('Add Flex Time')).toBeInTheDocument();
  });

  test('shows "Edit Flex Time" title when initialProgram provided', () => {
    const initialProgram: UIFlexProgram & { index: number } = {
      type: 'flex',
      duration: 300000, // 5 minutes in ms
      persisted: false,
      uiIndex: 0,
      originalIndex: 0,
      index: 0,
    };

    renderWithProviders(
      <AddFlexModal open={true} onClose={() => {}} initialProgram={initialProgram} />,
    );

    expect(screen.getByText('Edit Flex Time')).toBeInTheDocument();
  });

  test('displays validation error for empty input', async () => {
    const { user } = renderWithProviders(
      <AddFlexModal open={true} onClose={() => {}} />,
    );

    const input = screen.getByLabelText('Duration (seconds)');

    // Clear the input - component rejects non-numeric input, so clearing shows numeric error
    await user.clear(input);

    // When input is empty, it shows "must be numeric" error
    expect(screen.getByText('Duration must be numeric')).toBeInTheDocument();
  });

  test('displays validation error for zero value', async () => {
    const { user } = renderWithProviders(
      <AddFlexModal open={true} onClose={() => {}} />,
    );

    const input = screen.getByLabelText('Duration (seconds)');
    await user.clear(input);
    await user.type(input, '0');

    expect(screen.getByText('Duration must be greater than 0.')).toBeInTheDocument();
  });

  test('shows humanized duration in helper text for valid input', () => {
    renderWithProviders(<AddFlexModal open={true} onClose={() => {}} />);

    // Default is 5 minutes (300 seconds)
    // dayjs humanizes this as "5 minutes"
    expect(screen.getByText('5 minutes')).toBeInTheDocument();
  });

  test('calls addProgramsToCurrentChannel on save (add mode)', async () => {
    const onClose = vi.fn();
    const { user } = renderWithProviders(
      <AddFlexModal open={true} onClose={onClose} />,
    );

    const saveButton = screen.getByRole('button', { name: 'Save' });
    await user.click(saveButton);

    expect(mockAddProgramsToCurrentChannel).toHaveBeenCalledWith([
      { type: 'flex', duration: 300000, persisted: false }, // 300 seconds in ms
    ]);
    expect(onClose).toHaveBeenCalled();
  });

  test('calls setProgramAtIndex on save (edit mode)', async () => {
    const onClose = vi.fn();
    const initialProgram: UIFlexProgram & { index: number } = {
      type: 'flex',
      duration: 600000, // 10 minutes
      persisted: false,
      uiIndex: 0,
      originalIndex: 0,
      index: 5,
    };

    const { user } = renderWithProviders(
      <AddFlexModal open={true} onClose={onClose} initialProgram={initialProgram} />,
    );

    const saveButton = screen.getByRole('button', { name: 'Save' });
    await user.click(saveButton);

    expect(mockSetProgramAtIndex).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'flex',
        duration: 600000,
        persisted: false,
      }),
      5,
    );
    expect(onClose).toHaveBeenCalled();
  });

  test('calls onClose when cancel clicked', async () => {
    const onClose = vi.fn();
    const { user } = renderWithProviders(
      <AddFlexModal open={true} onClose={onClose} />,
    );

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelButton);

    expect(onClose).toHaveBeenCalled();
    expect(mockAddProgramsToCurrentChannel).not.toHaveBeenCalled();
  });

  test('does not render when open is false', () => {
    renderWithProviders(<AddFlexModal open={false} onClose={() => {}} />);

    expect(screen.queryByText('Add Flex Time')).not.toBeInTheDocument();
  });

  test('updates duration when user types new value', async () => {
    const { user } = renderWithProviders(
      <AddFlexModal open={true} onClose={() => {}} />,
    );

    const input = screen.getByLabelText('Duration (seconds)');
    await user.clear(input);
    await user.type(input, '3600');

    // 3600 seconds = 1 hour, humanized as "an hour"
    expect(screen.getByText('an hour')).toBeInTheDocument();
  });
});
