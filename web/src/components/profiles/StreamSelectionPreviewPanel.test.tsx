import type {
  PostApiStreamSelectionProfilesPreviewData,
  PostApiStreamSelectionProfilesPreviewResponse,
} from '@/generated/types.gen';
import type { TerminalProgram } from '@tunarr/types';
import type { UserEvent } from '@testing-library/user-event';
import { FormProvider, useForm } from 'react-hook-form';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type * as Sdk from '../../generated/sdk.gen.ts';
import { makeMovie } from '../../test/programFixtures.ts';
import type { StreamSelectionProfileFormValues } from './streamSelectionFormTypes.ts';
import { defaultRule } from './streamSelectionFormTypes.ts';

type PreviewBody = PostApiStreamSelectionProfilesPreviewData['body'];
type PreviewResult = PostApiStreamSelectionProfilesPreviewResponse;

vi.mock('@tanstack/react-router', () => import('@/test/routerMock.tsx'));

const mocks = vi.hoisted(() => ({
  programs: [] as TerminalProgram[],
  preview: vi.fn(),
}));

// The real search queries the search index. A button per program is enough to
// drive the panel.
vi.mock('../ProgramSearchAutocomplete.tsx', () => ({
  ProgramSearchAutocomplete: ({
    onChange,
  }: {
    onChange: (program: TerminalProgram) => void;
  }) => (
    <div>
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

const channels = {
  'ch-a': { uuid: 'ch-a', name: 'Anime', number: 7 },
  'ch-b': { uuid: 'ch-b', name: 'Movies', number: 8 },
};

vi.mock('../../generated/sdk.gen.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof Sdk>()),
  getChannels: () =>
    Promise.resolve({
      data: Object.values(channels).map(({ uuid, name, number }) => ({
        id: uuid,
        name,
        number,
      })),
    }),
  postApiStreamSelectionProfilesPreview: mocks.preview,
}));

const { renderWithProviders, screen } = await import('../../test/utils.tsx');
const { StreamSelectionPreviewPanel } = await import(
  './StreamSelectionPreviewPanel.tsx'
);

const spiritedAway = makeMovie({ uuid: 'movie-a', title: 'Spirited Away' });
const akira = makeMovie({ uuid: 'movie-b', title: 'Akira' });

const previewRules: PreviewBody['rules'] = [
  {
    label: 'Japanese',
    condition: 'true',
    audioAction: { type: 'by_language', languages: ['jpn'] },
    subtitleAction: { type: 'default' },
  },
];

function previewResult(body: PreviewBody): PreviewResult {
  const channel =
    body.channelId === 'ch-a' || body.channelId === 'ch-b'
      ? channels[body.channelId]
      : undefined;
  const subtitle = {
    index: 3,
    codec: 'subrip',
    language: 'eng',
    type: 'embedded' as const,
  };
  return {
    program: { uuid: body.programId, title: 'Spirited Away', type: 'movie' },
    channel,
    audioStreams: [{ index: 1, codec: 'aac', language: 'jpn' }],
    subtitleStreams: [subtitle],
    rules: [{ label: 'Japanese', condition: 'true', matched: true }],
    matchedRuleIndex: 0,
    selectedAudioStream: { index: 1, codec: 'aac', language: 'jpn' },
    selectedSubtitleStream: subtitle,
  };
}

function Harness({ validateRules }: { validateRules: () => Promise<boolean> }) {
  const methods = useForm<StreamSelectionProfileFormValues>({
    defaultValues: { name: '', rules: [{ ...defaultRule }] },
  });
  return (
    <FormProvider {...methods}>
      <input aria-label="Rule label" {...methods.register('rules.0.label')} />
      <StreamSelectionPreviewPanel
        getRules={() => previewRules}
        validateRules={validateRules}
      />
    </FormProvider>
  );
}

async function renderPanel(validateRules = () => Promise.resolve(true)) {
  const view = renderWithProviders(<Harness validateRules={validateRules} />);
  await view.user.click(screen.getByRole('button', { name: /^Test/ }));
  return view;
}

async function chooseChannel(user: UserEvent, option: string) {
  await user.click(screen.getByRole('combobox'));
  await user.click(await screen.findByRole('option', { name: option }));
}

describe('StreamSelectionPreviewPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.programs = [spiritedAway, akira];
    mocks.preview.mockImplementation(({ body }: { body: PreviewBody }) =>
      Promise.resolve({ data: previewResult(body) }),
    );
  });

  test('runs the rules against the picked program and shows the selection', async () => {
    const { user } = await renderPanel();

    await user.click(
      screen.getByRole('button', { name: 'Pick Spirited Away' }),
    );
    await chooseChannel(user, 'None');
    await user.click(screen.getByRole('button', { name: 'Run' }));

    expect(mocks.preview).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          rules: previewRules,
          programId: 'movie-a',
          channelId: undefined,
        },
      }),
    );
    expect(await screen.findByText('Applied')).toBeInTheDocument();
    expect(
      screen.getByText('Subtitles: #3 · eng · subrip'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Troubleshoot shows an embedded text subtitle/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Open in Troubleshoot' }),
    ).toBeInTheDocument();
  });

  test('does not run when the rules fail validation', async () => {
    const validateRules = vi.fn(() => Promise.resolve(false));
    const { user } = await renderPanel(validateRules);

    await user.click(
      screen.getByRole('button', { name: 'Pick Spirited Away' }),
    );
    await user.click(screen.getByRole('button', { name: 'Run' }));

    expect(validateRules).toHaveBeenCalled();
    expect(mocks.preview).not.toHaveBeenCalled();
    expect(
      screen.getByText('Fix the errors in the rules above to run a test.'),
    ).toBeInTheDocument();
  });

  test('links Troubleshoot to the tested channel and flags a changed target', async () => {
    const { user } = await renderPanel();

    await user.click(
      screen.getByRole('button', { name: 'Pick Spirited Away' }),
    );
    await chooseChannel(user, '7 - Anime');
    await user.click(screen.getByRole('button', { name: 'Run' }));

    const link = await screen.findByRole('link', {
      name: 'Troubleshoot on channel Anime',
    });
    expect(link).toBeInTheDocument();
    expect(screen.queryByText(/changed since this test ran/)).toBeNull();

    await chooseChannel(user, '8 - Movies');
    expect(screen.getByText(/changed since this test ran/)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Troubleshoot on channel Anime' }),
    ).toBeInTheDocument();

    await chooseChannel(user, '7 - Anime');
    expect(screen.queryByText(/changed since this test ran/)).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Pick Akira' }));
    expect(screen.getByText(/changed since this test ran/)).toBeInTheDocument();
  });

  test('flags the result when the rules change after a run', async () => {
    const { user } = await renderPanel();

    await user.click(
      screen.getByRole('button', { name: 'Pick Spirited Away' }),
    );
    await user.click(screen.getByRole('button', { name: 'Run' }));
    await screen.findByText('Applied');
    expect(screen.queryByText(/changed since this test ran/)).toBeNull();

    await user.type(screen.getByRole('textbox', { name: 'Rule label' }), 'x');

    expect(screen.getByText(/changed since this test ran/)).toBeInTheDocument();
  });
});
