import type { Meta, StoryObj } from '@storybook/react-vite';
import type { SmartCollection } from '@tunarr/types';
import { expect, fn, userEvent, within } from 'storybook/test';
import { StoryRouter } from '../ui/patterns/AppShell/storyComponents.tsx';
import { SmartCollectionsView } from './SmartCollectionsView.tsx';

const storyCollections: SmartCollection[] = [
  {
    uuid: '00000000-0000-4000-8000-000000000001',
    name: '80s Action',
    keywords: '',
    filterString:
      'type:movie AND genre:action AND year >= 1980 AND year < 1990',
  },
  {
    uuid: '00000000-0000-4000-8000-000000000002',
    name: 'Christmas',
    keywords: 'christmas',
    filterString: '',
  },
  {
    uuid: '00000000-0000-4000-8000-000000000003',
    name: 'Kids Cartoons',
    keywords: 'cartoon',
    filterString: 'genre:animation AND rating IN (G, TV-Y, TV-Y7)',
  },
  {
    uuid: '00000000-0000-4000-8000-000000000004',
    name: 'Everything',
    keywords: '',
  },
];

const longTextCollection: SmartCollection = {
  uuid: '00000000-0000-4000-8000-000000000005',
  name: 'Every Late Night Talk Show Episode With a Musical Guest From the Nineties',
  keywords: 'musical guest performance',
  filterString:
    'type:episode AND genre:talk AND year >= 1990 AND year < 2000 AND (show_title:"The Tonight Show" OR show_title:"Late Show" OR show_title:"Late Night")',
};

// Layout follows the toolbar's density unless a story forces one.
const meta = {
  title: 'Smart Collections/SmartCollectionsView',
  component: SmartCollectionsView,
  decorators: [
    (Story) => (
      <StoryRouter path="/library/smart_collections">
        <Story />
      </StoryRouter>
    ),
  ],
  args: {
    collections: storyCollections,
    onOpenCollection: fn(),
    onEditCollection: fn(),
    onDeleteCollection: fn(),
  },
} satisfies Meta<typeof SmartCollectionsView>;

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
  args: { collections: [longTextCollection, ...storyCollections] },
};

export const LongTextTable: Story = {
  args: {
    collections: [longTextCollection, ...storyCollections],
    layout: 'table',
  },
};

export const Empty: Story = { args: { collections: [] } };

export const EmptyTable: Story = {
  args: { collections: [], layout: 'table' },
};

export const CardActions: Story = {
  args: { layout: 'cards' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Edit Christmas' }),
    );
    await expect(args.onEditCollection).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Christmas' }),
    );

    await userEvent.click(
      canvas.getByRole('button', { name: 'Delete 80s Action' }),
    );
    const dialog = within(
      within(canvasElement.ownerDocument.body).getByRole('dialog'),
    );
    await userEvent.click(dialog.getByRole('button', { name: 'Delete' }));
    await expect(args.onDeleteCollection).toHaveBeenCalledWith(
      expect.objectContaining({ name: '80s Action' }),
    );
    await expect(args.onOpenCollection).not.toHaveBeenCalled();
  },
};
