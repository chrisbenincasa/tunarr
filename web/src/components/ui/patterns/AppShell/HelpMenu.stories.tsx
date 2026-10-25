import { Box } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn, screen } from 'storybook/test';
import { HelpMenu } from './HelpMenu.tsx';

const meta = {
  title: 'Patterns/HelpMenu',
  component: HelpMenu,
  decorators: [
    (Story) => (
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', height: 420 }}>
        <Story />
      </Box>
    ),
  ],
  args: {
    version: { state: 'loaded', tunarr: '1.2.0', ffmpeg: '7.1.1' },
    onCopyXmlTvUrl: fn(),
    onCopyM3uUrl: fn(),
  },
} satisfies Meta<typeof HelpMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

const openMenu: Story['play'] = async ({ canvas, userEvent }) => {
  await userEvent.click(canvas.getByRole('button', { name: 'Help and links' }));
  await screen.findByRole('menu');
};

export const Closed: Story = {};

export const Open: Story = { play: openMenu };

export const OpenDenseLight: Story = {
  play: openMenu,
  globals: { density: 'dense', scheme: 'light' },
};

export const PhoneButton: Story = {
  args: { variant: 'plain' },
  play: openMenu,
};

export const LongVersionStrings: Story = {
  args: {
    version: {
      state: 'loaded',
      tunarr: '2026.10.3-dev.42+sha.9532e05d5f081422e',
      ffmpeg: 'n7.1.1-27-g2b7fbe8b6b-20260412 Copyright (c) 2000-2026',
    },
  },
  play: openMenu,
};

export const VersionLoading: Story = {
  args: { version: { state: 'loading' } },
  play: openMenu,
};

export const VersionUnknown: Story = {
  args: { version: { state: 'error' } },
  play: openMenu,
};
