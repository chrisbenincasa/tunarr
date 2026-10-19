import { Add, FileDownloadOutlined } from '@mui/icons-material';
import { Button } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { PageHeader } from './PageHeader.tsx';

const meta = {
  title: 'Primitives/PageHeader',
  component: PageHeader,
  args: {
    title: 'Channels',
    subtitle: '7 channels · 2 live now',
  },
} satisfies Meta<typeof PageHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithActions: Story = {
  args: {
    actions: (
      <>
        <Button variant="outlined" startIcon={<FileDownloadOutlined />}>
          Export M3U
        </Button>
        <Button variant="contained" startIcon={<Add />}>
          New channel
        </Button>
      </>
    ),
  },
};

export const WithEyebrow: Story = {
  args: {
    eyebrow: 'Channel 2',
    title: 'Classic Sitcoms',
    subtitle: 'Programming · 6 unsaved changes',
  },
};

export const LongTitleWraps: Story = {
  args: {
    title:
      'Saturday Morning Cartoons and Weekday Afternoon Reruns Marathon Channel',
    actions: <Button variant="contained">Save</Button>,
  },
};
