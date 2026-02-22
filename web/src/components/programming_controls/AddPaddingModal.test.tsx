import { describe, expect, test, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, within } from '@/test/utils';
import AddPaddingModal from './AddPaddingModal';
import { StartTimePaddingOptions } from '@/hooks/programming_controls/usePadStartTimes';

// Mock the usePadStartTimes hook
const mockPadStartTimes = vi.fn();

vi.mock('@/hooks/programming_controls/usePadStartTimes', async () => {
  const actual = await vi.importActual<
    typeof import('@/hooks/programming_controls/usePadStartTimes')
  >('@/hooks/programming_controls/usePadStartTimes');
  return {
    ...actual,
    usePadStartTimes: () => mockPadStartTimes,
  };
});

describe('AddPaddingModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders with dialog title', () => {
    renderWithProviders(<AddPaddingModal open={true} onClose={() => {}} />);

    // Use getByRole to specifically get the dialog title
    expect(screen.getByRole('heading', { name: 'Pad Start Times' })).toBeInTheDocument();
  });

  test('renders description text', () => {
    renderWithProviders(<AddPaddingModal open={true} onClose={() => {}} />);

    expect(
      screen.getByText(/Adds Flex breaks after each TV episode or movie/),
    ).toBeInTheDocument();
  });

  test('renders with select dropdown', () => {
    renderWithProviders(<AddPaddingModal open={true} onClose={() => {}} />);

    // MUI Select uses a combobox role
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  test('shows all padding options when dropdown is opened', async () => {
    const { user } = renderWithProviders(
      <AddPaddingModal open={true} onClose={() => {}} />,
    );

    // Click to open the select dropdown
    const select = screen.getByRole('combobox');
    await user.click(select);

    // Check that all options are present
    const listbox = screen.getByRole('listbox');
    for (const option of StartTimePaddingOptions) {
      expect(within(listbox).getByText(option.description)).toBeInTheDocument();
    }
  });

  test('calls padStartTimes with selected option on save', async () => {
    const onClose = vi.fn();
    const { user } = renderWithProviders(
      <AddPaddingModal open={true} onClose={onClose} />,
    );

    // Open the select dropdown
    const select = screen.getByRole('combobox');
    await user.click(select);

    // Select the 15 minute option (":00, :15, :30, :45")
    const listbox = screen.getByRole('listbox');
    const option15min = within(listbox).getByText(':00, :15, :30, :45');
    await user.click(option15min);

    // Click Add Padding button
    const addButton = screen.getByRole('button', { name: /Add Padding/i });
    await user.click(addButton);

    expect(mockPadStartTimes).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 15,
        mod: 15,
        description: ':00, :15, :30, :45',
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  test('calls padStartTimes with null when no option selected', async () => {
    const onClose = vi.fn();
    const { user } = renderWithProviders(
      <AddPaddingModal open={true} onClose={onClose} />,
    );

    // Click Add Padding without selecting anything
    const addButton = screen.getByRole('button', { name: /Add Padding/i });
    await user.click(addButton);

    expect(mockPadStartTimes).toHaveBeenCalledWith(null);
    expect(onClose).toHaveBeenCalled();
  });

  test('calls onClose on cancel without calling padStartTimes', async () => {
    const onClose = vi.fn();
    const { user } = renderWithProviders(
      <AddPaddingModal open={true} onClose={onClose} />,
    );

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelButton);

    expect(onClose).toHaveBeenCalled();
    expect(mockPadStartTimes).not.toHaveBeenCalled();
  });

  test('does not render when open is false', () => {
    renderWithProviders(<AddPaddingModal open={false} onClose={() => {}} />);

    expect(screen.queryByRole('heading', { name: 'Pad Start Times' })).not.toBeInTheDocument();
  });

  test('allows selecting None option', async () => {
    const onClose = vi.fn();
    const { user } = renderWithProviders(
      <AddPaddingModal open={true} onClose={onClose} />,
    );

    // Open the select dropdown
    const select = screen.getByRole('combobox');
    await user.click(select);

    // Select "None"
    const listbox = screen.getByRole('listbox');
    const noneOption = within(listbox).getByText('None');
    await user.click(noneOption);

    // Click Add Padding
    const addButton = screen.getByRole('button', { name: /Add Padding/i });
    await user.click(addButton);

    // When "None" is selected (key: -1), the handler sets padding to null
    expect(mockPadStartTimes).toHaveBeenCalledWith(null);
  });
});
