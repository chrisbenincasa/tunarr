import { Add } from '@mui/icons-material';
import { Button } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { MediaSourceSettings } from '@tunarr/types';
import { expect, fn, userEvent, within } from 'storybook/test';
import { StoryRouter } from '../../ui/patterns/AppShell/storyComponents.tsx';
import { MediaSourcesView } from './MediaSourcesView.tsx';

const library = (
  n: number,
  type: MediaSourceSettings['type'],
  enabled: boolean,
): MediaSourceSettings['libraries'][number] => ({
  id: `00000000-0000-4000-8000-0000000001${n.toString().padStart(2, '0')}`,
  name: `Library ${n}`,
  mediaType: 'movies',
  externalKey: `${n}`,
  type,
  enabled,
  isLocked: false,
});

const remoteDefaults = {
  accessToken: 'token',
  userId: null,
  username: null,
  sendPlayStatusUpdates: false,
  pathReplacements: [],
};

const storySources: MediaSourceSettings[] = [
  {
    ...remoteDefaults,
    id: 'plex',
    name: 'Living Room Plex',
    type: 'plex',
    uri: 'http://192.168.1.20:32400',
    sendGuideUpdates: false,
    index: 0,
    libraries: [
      library(1, 'plex', true),
      library(2, 'plex', true),
      library(3, 'plex', false),
    ],
  },
  {
    ...remoteDefaults,
    id: 'jellyfin',
    name: 'Jellyfin',
    type: 'jellyfin',
    uri: 'https://jellyfin.example.com',
    libraries: [library(4, 'jellyfin', false), library(5, 'jellyfin', false)],
  },
  {
    ...remoteDefaults,
    id: 'emby',
    name: 'Emby Archive',
    type: 'emby',
    uri: 'http://emby.lan:8096',
    libraries: [library(6, 'emby', true)],
  },
  {
    id: 'local',
    name: 'Home Movies',
    type: 'local',
    mediaType: 'other_videos',
    paths: ['/media/home-movies', '/mnt/backup/home-movies'],
    pathReplacements: [],
    libraries: [],
  },
];

const longTextSource: MediaSourceSettings = {
  ...remoteDefaults,
  id: 'long',
  name: "The Basement Server That Holds Every Recording From Grandpa's VHS Collection",
  type: 'plex',
  uri: 'https://plex-basement-server.some-very-long-dynamic-dns-hostname.example.com:32400',
  sendGuideUpdates: false,
  index: 1,
  libraries: [library(7, 'plex', true)],
};

const addButton = (
  <Button variant="contained" startIcon={<Add />}>
    Add
  </Button>
);

// Layout follows the toolbar's density unless a story forces one.
const meta = {
  title: 'Settings/MediaSourcesView',
  component: MediaSourcesView,
  decorators: [
    (Story) => (
      <StoryRouter path="/settings/sources">
        <Story />
      </StoryRouter>
    ),
  ],
  args: {
    mediaSources: storySources,
    health: {
      plex: 'healthy',
      jellyfin: 'unhealthy',
      emby: 'checking',
      local: 'healthy',
      long: 'healthy',
    },
    addButton,
    onOpenSource: fn(),
    onEditSource: fn(),
    onRefreshLibraries: fn(),
    onEditLibraries: fn(),
    onDeleteSource: fn(),
  },
} satisfies Meta<typeof MediaSourcesView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FollowsDensity: Story = {};

const equalCardHeights: Story['play'] = async ({ canvasElement }) => {
  const cards = within(canvasElement).getAllByRole('article');
  const heights = new Set(cards.map((c) => c.getBoundingClientRect().height));
  await expect(heights.size).toBe(1);
};

export const Cards: Story = {
  args: { layout: 'cards' },
  play: equalCardHeights,
};

export const CardsDense: Story = {
  args: { layout: 'cards' },
  globals: { density: 'dense' },
  play: equalCardHeights,
};

export const Table: Story = { args: { layout: 'table' } };

export const LongText: Story = {
  args: { mediaSources: [longTextSource, ...storySources] },
};

export const LongTextTable: Story = {
  args: { mediaSources: [longTextSource, ...storySources], layout: 'table' },
};

export const Empty: Story = { args: { mediaSources: [] } };

export const EmptyTable: Story = {
  args: { mediaSources: [], layout: 'table' },
};

export const CardActions: Story = {
  args: { layout: 'cards' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Edit Living Room Plex' }),
    );
    await expect(args.onEditSource).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'plex' }),
    );

    await userEvent.click(
      canvas.getByRole('button', { name: 'Refresh libraries of Jellyfin' }),
    );
    await expect(args.onRefreshLibraries).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'jellyfin' }),
    );

    await userEvent.click(
      canvas.getByRole('button', { name: 'Edit libraries of Emby Archive' }),
    );
    await expect(args.onEditLibraries).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'emby' }),
    );

    await userEvent.click(
      canvas.getByRole('button', { name: 'Delete Home Movies' }),
    );
    const dialog = within(
      within(canvasElement.ownerDocument.body).getByRole('dialog'),
    );
    await userEvent.click(dialog.getByRole('button', { name: 'Delete' }));
    await expect(args.onDeleteSource).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'local' }),
    );
    await expect(args.onOpenSource).not.toHaveBeenCalled();
  },
};
