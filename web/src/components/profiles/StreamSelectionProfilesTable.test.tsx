import type { GetApiStreamSelectionProfilesResponse } from '@/generated/types.gen';
import type { ComponentProps, ReactNode } from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type * as Sdk from '../../generated/sdk.gen.ts';

type Profile = GetApiStreamSelectionProfilesResponse[number];

const navigateMock = vi.fn((_opts: unknown) => Promise.resolve());

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
  Link: ({ to, ...props }: ComponentProps<'a'> & { to: string }) => (
    <a href={to} {...props} />
  ),
  createLink:
    () =>
    ({ to, children }: { to: string; children?: ReactNode }) => (
      <a href={to}>{children}</a>
    ),
}));

const sdk = vi.hoisted(() => ({
  profiles: [] as Profile[],
  postProfile: vi.fn((_opts: unknown) =>
    Promise.resolve({ data: { uuid: 'copy-1' } }),
  ),
  putSettings: vi.fn((_opts: unknown) => Promise.resolve({ data: {} })),
  deleteProfile: vi.fn((_opts: unknown) => Promise.resolve({ data: {} })),
}));

vi.mock('../../generated/sdk.gen.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof Sdk>()),
  getApiStreamSelectionProfiles: () => Promise.resolve({ data: sdk.profiles }),
  postApiStreamSelectionProfiles: sdk.postProfile,
  putApiStreamSelectionSettings: sdk.putSettings,
  deleteApiStreamSelectionProfilesById: sdk.deleteProfile,
}));

const { renderWithProviders, screen, within } = await import(
  '../../test/utils.tsx'
);
const { StreamSelectionProfilesTable } = await import(
  './StreamSelectionProfilesTable.tsx'
);

const noUsage: Profile['usage'] = {
  channels: [],
  fillerLists: [],
  customShows: [],
  programCount: 0,
};

const makeProfile = (overrides: Partial<Profile>): Profile => ({
  uuid: 'p',
  name: 'Profile',
  rules: [
    {
      condition: 'true',
      audioAction: { type: 'default' },
      subtitleAction: { type: 'disable' },
    },
  ],
  locked: false,
  usage: noUsage,
  isDefault: false,
  ...overrides,
});

const builtIn = makeProfile({
  uuid: 'built-in',
  name: 'Tunarr Default',
  locked: true,
});

const anime = makeProfile({
  uuid: 'anime',
  name: 'Anime',
  isDefault: true,
  usage: {
    ...noUsage,
    channels: [
      { uuid: 'c1', name: 'One', number: 1 },
      { uuid: 'c2', name: 'Two', number: 2 },
    ],
  },
});

const rowFor = async (name: string) =>
  within(
    (await screen.findByText(name, { selector: 'span' })).closest('tr') ??
      document.body,
  );

describe('StreamSelectionProfilesTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sdk.profiles = [builtIn, anime];
  });

  test('shows each profile with its default flag and usage', async () => {
    renderWithProviders(<StreamSelectionProfilesTable />);

    const animeRow = await rowFor('Anime');
    expect(animeRow.getByText('Default')).toBeInTheDocument();
    expect(animeRow.getByText('2 channel(s)')).toBeInTheDocument();

    const builtInRow = await rowFor('Tunarr Default');
    expect(builtInRow.getByText('Not assigned')).toBeInTheDocument();
  });

  test('offers View but not Delete for a locked profile', async () => {
    renderWithProviders(<StreamSelectionProfilesTable />);

    const builtInRow = await rowFor('Tunarr Default');
    expect(builtInRow.getByRole('link', { name: 'View' })).toBeInTheDocument();
    expect(builtInRow.queryByRole('button', { name: 'Delete' })).toBeNull();

    const animeRow = await rowFor('Anime');
    expect(animeRow.getByRole('link', { name: 'Edit' })).toBeInTheDocument();
    expect(
      animeRow.getByRole('button', { name: 'Delete' }),
    ).toBeInTheDocument();
  });

  test('sets another profile as the default', async () => {
    const { user } = renderWithProviders(<StreamSelectionProfilesTable />);

    const animeRow = await rowFor('Anime');
    expect(
      animeRow.getByRole('button', { name: 'Set as default' }),
    ).toBeDisabled();

    const builtInRow = await rowFor('Tunarr Default');
    await user.click(
      builtInRow.getByRole('button', { name: 'Set as default' }),
    );

    expect(sdk.putSettings).toHaveBeenCalledWith(
      expect.objectContaining({ body: { defaultProfileId: 'built-in' } }),
    );
  });

  test('duplicates a profile and opens the copy', async () => {
    const { user } = renderWithProviders(<StreamSelectionProfilesTable />);

    const animeRow = await rowFor('Anime');
    await user.click(animeRow.getByRole('button', { name: 'Duplicate' }));

    expect(sdk.postProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { name: 'Copy of Anime', rules: anime.rules },
      }),
    );
    await vi.waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith({
        to: '/profiles/stream-selection/$profileId',
        params: { profileId: 'copy-1' },
      }),
    );
  });

  test('warns before deleting the default profile', async () => {
    const { user } = renderWithProviders(<StreamSelectionProfilesTable />);

    const animeRow = await rowFor('Anime');
    await user.click(animeRow.getByRole('button', { name: 'Delete' }));

    const dialog = within(await screen.findByRole('dialog'));
    expect(
      dialog.getByText(/The built-in profile will become the default/),
    ).toBeInTheDocument();
    await user.click(dialog.getByRole('button', { name: 'Delete' }));

    expect(sdk.deleteProfile).toHaveBeenCalledWith(
      expect.objectContaining({ path: { id: 'anime' } }),
    );
  });
});
