import type { GetApiStreamSelectionProfilesByIdResponse } from '@/generated/types.gen';
import type { TerminalProgram } from '@tunarr/types';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type * as Sdk from '../../generated/sdk.gen.ts';

type Profile = GetApiStreamSelectionProfilesByIdResponse;

const navigateMock = vi.fn((_opts: unknown) => Promise.resolve());

vi.mock('@tanstack/react-router', async () => ({
  ...(await import('@/test/routerMock.tsx')),
  useNavigate: () => navigateMock,
  useParams: () => ({ profileId: 'anime' }),
}));

const sdk = vi.hoisted(() => ({
  profile: undefined as Profile | undefined,
  searchResult: undefined as TerminalProgram | undefined,
  preview: vi.fn(),
  putProfile: vi.fn(),
  postProfile: vi.fn((_opts: unknown) =>
    Promise.resolve({ data: { uuid: 'created-1' } }),
  ),
}));

vi.mock('../../generated/sdk.gen.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof Sdk>()),
  getApiStreamSelectionProfiles: () => Promise.resolve({ data: [] }),
  getApiStreamSelectionProfilesById: () =>
    Promise.resolve({ data: sdk.profile }),
  putApiStreamSelectionProfilesById: sdk.putProfile,
  postApiStreamSelectionProfiles: sdk.postProfile,
  postApiStreamSelectionProfilesValidateExpression: () =>
    Promise.resolve({ data: { valid: true } }),
  postApiStreamSelectionProfilesPreview: sdk.preview,
  getChannels: () => Promise.resolve({ data: [] }),
}));

vi.mock('../../components/ProgramSearchAutocomplete.tsx', () => ({
  ProgramSearchAutocomplete: ({
    onChange,
  }: {
    onChange: (program: TerminalProgram) => void;
  }) => (
    <button
      type="button"
      onClick={() => sdk.searchResult && onChange(sdk.searchResult)}
    >
      Pick program
    </button>
  ),
}));

const { renderWithProviders, screen, within } = await import(
  '../../test/utils.tsx'
);
const { StreamSelectionProfilePage } = await import(
  './StreamSelectionProfilePage.tsx'
);
const { makeMovie } = await import('../../test/programFixtures.ts');

const makeProfile = (overrides: Partial<Profile> = {}): Profile => ({
  uuid: 'anime',
  name: 'Anime',
  locked: false,
  rules: [
    {
      condition: 'true',
      audioAction: { type: 'default' },
      subtitleAction: { type: 'disable' },
    },
  ],
  ...overrides,
});

const breadcrumbs = () => within(screen.getByRole('navigation'));

describe('StreamSelectionProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sdk.profile = makeProfile();
    sdk.putProfile.mockImplementation(
      ({ body }: { body: { name: string } }) => {
        sdk.profile = makeProfile({ name: body.name });
        return Promise.resolve({ data: sdk.profile });
      },
    );
  });

  test('shows the new name in the breadcrumb after saving', async () => {
    const { user } = renderWithProviders(
      <StreamSelectionProfilePage isNew={false} />,
    );
    const name = await screen.findByDisplayValue('Anime');
    expect(breadcrumbs().getByText('Anime')).toBeInTheDocument();

    await user.clear(name);
    await user.type(name, 'Cartoons');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(sdk.putProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        path: { id: 'anime' },
        body: expect.objectContaining({ name: 'Cartoons' }),
      }),
    );
    expect(await breadcrumbs().findByText('Cartoons')).toBeInTheDocument();
  });

  test('shows a locked profile read-only and duplicates it', async () => {
    sdk.profile = makeProfile({
      uuid: 'built-in',
      name: 'Tunarr Default',
      locked: true,
    });
    const { user } = renderWithProviders(
      <StreamSelectionProfilePage isNew={false} />,
    );

    expect(await screen.findByDisplayValue('Tunarr Default')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Duplicate' }));

    expect(sdk.postProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { name: 'Copy of Tunarr Default', rules: sdk.profile.rules },
      }),
    );
    await vi.waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith({
        to: '/profiles/stream-selection/$profileId',
        params: { profileId: 'created-1' },
      }),
    );
  });

  test('creates a new profile and opens it', async () => {
    const { user } = renderWithProviders(<StreamSelectionProfilePage isNew />);

    await user.type(
      screen.getByRole('textbox', { name: 'Profile Name' }),
      'Kids',
    );
    await user.click(screen.getByRole('button', { name: 'Create Profile' }));

    expect(sdk.postProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          name: 'Kids',
          rules: [
            {
              label: undefined,
              condition: 'true',
              audioAction: { type: 'default' },
              subtitleAction: { type: 'default' },
            },
          ],
        },
      }),
    );
    await vi.waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith({
        to: '/profiles/stream-selection/$profileId',
        params: { profileId: 'created-1' },
      }),
    );
  });

  test('tests the rules of a new profile before it has a name', async () => {
    sdk.searchResult = makeMovie({ uuid: 'movie-1', title: 'Akira' });
    sdk.preview.mockReturnValue(new Promise(() => {}));
    const { user } = renderWithProviders(<StreamSelectionProfilePage isNew />);

    await user.click(screen.getByRole('button', { name: /^Test/ }));
    await user.click(screen.getByRole('button', { name: 'Pick program' }));
    await user.click(screen.getByRole('button', { name: 'Run' }));

    await vi.waitFor(() =>
      expect(sdk.preview).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({ programId: 'movie-1' }),
        }),
      ),
    );
    expect(
      screen.queryByText('Fix the errors in the rules above to run a test.'),
    ).toBeNull();
  });
});
