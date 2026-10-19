import { Box, useColorScheme } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useRouterState } from '@tanstack/react-router';
import { useState } from 'react';
import { AppShell } from './AppShell.tsx';
import { CommandPalette } from './CommandPalette.tsx';
import { HelpMenu } from './HelpMenu.tsx';
import { resolveActiveNav, type ShellNav } from './navModel.ts';
import { filterPalette } from './paletteModel.ts';
import { PlaceholderPage, StoryRouter } from './storyComponents.tsx';
import {
  grownNav,
  longLabelNav,
  storyNav,
  withHealthBadge,
  withWelcome,
} from './storyFixtures.tsx';

type ShellStoryProps = {
  nav: ShellNav;
  path: string;
  layout: 'desktop' | 'phone';

  // Frame width in px. Desktop frames fill the canvas when unset.
  width?: number;
};

const paletteItems = [
  {
    id: 'c4',
    group: 'Channels',
    label: 'Sci-Fi Marathon',
    kind: 'Channel',
    number: '4',
  },
  {
    id: 'cs1',
    group: 'Custom Shows',
    label: 'Sci-Fi Shorts',
    kind: 'Custom show',
  },
  {
    id: 'sc1',
    group: 'Smart Collections',
    label: 'Sci-Fi Films',
    kind: 'Smart collection',
  },
];

// Clicking a link moves the memory router, and the shell follows it.
const LiveShell = ({
  nav,
  layout,
}: Omit<ShellStoryProps, 'path' | 'width'>) => {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = resolveActiveNav(nav, pathname);
  const { colorScheme, setMode } = useColorScheme();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState('');
  const isDark = colorScheme === 'dark';
  const section = [...nav.sections, nav.settings].find(
    (s) => s.id === active.sectionId,
  );
  const page = section?.pages.find((p) => p.id === active.pageId);

  return (
    <>
      <AppShell
        nav={nav}
        active={active}
        layout={layout}
        isDark={isDark}
        onToggleColorScheme={() => setMode(isDark ? 'light' : 'dark')}
        onOpenSearch={() => setPaletteOpen(true)}
        searchShortcut="⌘K"
        renderHelpMenu={(variant) => (
          <HelpMenu
            variant={variant}
            version={{ state: 'loaded', tunarr: '1.2.0', ffmpeg: '7.1.1' }}
            onCopyXmlTvUrl={() => {}}
            onCopyM3uUrl={() => {}}
          />
        )}
      >
        <PlaceholderPage title={page?.label ?? section?.label ?? 'Search'} />
      </AppShell>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        query={query}
        onQueryChange={setQuery}
        groups={filterPalette(paletteItems, query)}
        onSelect={() => setPaletteOpen(false)}
        onSearchLibrary={() => setPaletteOpen(false)}
      />
    </>
  );
};

const ShellStory = ({ nav, path, layout, width }: ShellStoryProps) => (
  <StoryRouter path={path}>
    <Box
      sx={{
        width: width ?? '100%',
        mx: 'auto',
        border: 1,
        borderColor: 'divider',

        // A transform makes the phone bottom bar's fixed position relative to
        // this frame instead of the canvas.
        ...(layout === 'phone'
          ? { height: 844, overflowY: 'auto', transform: 'translateZ(0)' }
          : {}),
      }}
    >
      <LiveShell nav={nav} layout={layout} />
    </Box>
  </StoryRouter>
);

const meta = {
  title: 'Patterns/AppShell',
  component: ShellStory,
  args: { nav: storyNav, path: '/library/fillers', layout: 'desktop' },
  argTypes: { nav: { control: false } },
} satisfies Meta<typeof ShellStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Library: Story = {};

export const LibraryDense: Story = { globals: { density: 'dense' } };

export const LibraryLight: Story = { globals: { scheme: 'light' } };

export const LibraryDenseLight: Story = {
  globals: { density: 'dense', scheme: 'light' },
};

export const GuideHasNoTabs: Story = { args: { path: '/guide' } };

export const SettingsGearActive: Story = {
  args: { path: '/settings/sources' },
};

export const SystemHealthBadge: Story = {
  args: { nav: withHealthBadge, path: '/system/logs' },
};

export const Width960SearchIcon: Story = { args: { width: 960 } };

// Spanish labels still fit at 820 px. At 700 px the wordmark goes first.
export const Width820LongLabelsFit: Story = {
  args: { nav: longLabelNav, width: 820 },
};

export const Width700LongLabelsDropWordmark: Story = {
  args: { nav: longLabelNav, width: 700 },
};

export const Width820MoreSections: Story = {
  args: { nav: grownNav, path: '/system', width: 820 },
};

export const Width640ActiveStaysVisible: Story = {
  args: { nav: grownNav, path: '/system/tasks', width: 640 },
};

export const Phone: Story = { args: { layout: 'phone', width: 390 } };

export const PhoneDense: Story = {
  args: { layout: 'phone', width: 390 },
  globals: { density: 'dense' },
};

export const PhoneLight: Story = {
  args: { layout: 'phone', width: 390 },
  globals: { scheme: 'light' },
};

export const PhoneSixItemsUseMore: Story = {
  args: {
    nav: withWelcome,
    layout: 'phone',
    width: 390,
    path: '/settings/general',
  },
};

export const PhoneLongLabels: Story = {
  args: { nav: longLabelNav, layout: 'phone', width: 390 },
};

export const PhoneHealthBadge: Story = {
  args: { nav: withHealthBadge, layout: 'phone', width: 390, path: '/guide' },
};
