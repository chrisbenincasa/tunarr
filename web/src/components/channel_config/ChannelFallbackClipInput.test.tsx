import type { SaveableChannel, TerminalProgram } from '@tunarr/types';
import { FormProvider, useForm } from 'react-hook-form';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type * as Sdk from '../../generated/sdk.gen.ts';
import { makeMovie } from '../../test/programFixtures.ts';

const mocks = vi.hoisted(() => ({
  programs: [] as TerminalProgram[],
  getProgram: vi.fn(),
}));

// The real search queries the search index. A button per program is enough to
// drive the input.
vi.mock('../ProgramSearchAutocomplete.tsx', () => ({
  ProgramSearchAutocomplete: ({
    value,
    onChange,
    helperText,
  }: {
    value: TerminalProgram | null;
    onChange: (program: TerminalProgram) => void;
    helperText?: string;
  }) => (
    <div>
      <output aria-label="Selected clip">{value?.title ?? ''}</output>
      {helperText && <p>{helperText}</p>}
      {mocks.programs.map((program) => (
        <button
          key={program.uuid}
          type="button"
          onClick={() => onChange(program)}
        >
          Pick {program.title}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('../../generated/sdk.gen.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof Sdk>()),
  getApiProgramsById: mocks.getProgram,
}));

const { renderWithProviders, screen } = await import('../../test/utils.tsx');
const { ChannelFallbackClipInput } = await import(
  './ChannelFallbackClipInput.tsx'
);

const savedClip = makeMovie({ uuid: 'saved-clip', title: 'Test Pattern' });
const otherClip = makeMovie({ uuid: 'other-clip', title: 'Station ID' });

function Harness({
  fallbackProgramId,
  onSubmit,
}: {
  fallbackProgramId: string | null;
  onSubmit: (values: SaveableChannel) => void;
}) {
  const methods = useForm<SaveableChannel>({
    defaultValues: { offline: { mode: 'clip' }, fallbackProgramId },
  });
  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        <ChannelFallbackClipInput />
        <button type="submit">Save</button>
      </form>
    </FormProvider>
  );
}

describe('ChannelFallbackClipInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.programs = [otherClip];
    mocks.getProgram.mockResolvedValue({ data: savedClip });
  });

  test('shows the saved clip by title', async () => {
    renderWithProviders(
      <Harness fallbackProgramId="saved-clip" onSubmit={vi.fn()} />,
    );

    expect(await screen.findByText('Test Pattern')).toBeInTheDocument();
  });

  test('stores the picked clip ID', async () => {
    const onSubmit = vi.fn();
    const { user } = renderWithProviders(
      <Harness fallbackProgramId="saved-clip" onSubmit={onSubmit} />,
    );

    await user.click(screen.getByRole('button', { name: 'Pick Station ID' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByLabelText('Selected clip')).toHaveTextContent(
      'Station ID',
    );
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ fallbackProgramId: 'other-clip' }),
      expect.anything(),
    );
  });

  test('blocks saving clip mode without a clip', async () => {
    const onSubmit = vi.fn();
    const { user } = renderWithProviders(
      <Harness fallbackProgramId={null} onSubmit={onSubmit} />,
    );

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('Choose a clip to play during flex time.'),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
