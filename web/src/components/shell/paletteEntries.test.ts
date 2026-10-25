import type { ShellNav } from '@/components/ui/patterns/AppShell';
import { describe, expect, test } from 'vitest';
import {
  buildPaletteEntries,
  type PaletteLabels,
  paletteGroups,
  searchLibraryTarget,
} from './paletteEntries.ts';

const labels: PaletteLabels = {
  pages: 'Pages',
  page: 'Page',
  channels: 'Channels',
  channel: 'Channel',
  customShows: 'Custom Shows',
  customShow: 'Custom show',
  fillerLists: 'Filler Lists',
  fillerList: 'Filler list',
  smartCollections: 'Smart Collections',
  smartCollection: 'Smart collection',
};

const nav: ShellNav = {
  sections: [
    {
      id: 'welcome',
      label: 'Welcome',
      to: '/welcome',
      icon: null,
      pages: [],
      hidden: true,
    },
    { id: 'guide', label: 'Guide', to: '/guide', icon: null, pages: [] },
    {
      id: 'library',
      label: 'Library',
      to: '/library',
      icon: null,
      pages: [
        { id: 'libraries', label: 'Libraries', to: '/library' },
        { id: 'fillers', label: 'Filler Lists', to: '/library/fillers' },
      ],
    },
  ],
  settings: {
    id: 'settings',
    label: 'Settings',
    to: '/settings/general',
    icon: null,
    pages: [
      { id: 'general', label: 'General', to: '/settings/general' },
      { id: 'xmltv', label: 'XMLTV', to: '/settings/xmltv' },
    ],
  },
};

const entries = buildPaletteEntries(nav, labels, {
  channels: [{ id: 'c1', name: 'Movies', number: 1 }],
  customShows: [{ id: 's1', name: 'Movie Marathon' }],
  fillers: [{ id: 'f1', name: 'Movie Trailers' }],
  smartCollections: [{ uuid: 'sc1', name: 'Movie Night' }],
});

const ids = (group: string) =>
  entries.filter((e) => e.item.group === group).map((e) => e.item.id);

describe('buildPaletteEntries', () => {
  test('a section without pages is one Page row', () => {
    const guide = entries.find((e) => e.item.id === 'Pages:guide');
    expect(guide?.item.kind).toBe('Page');
    expect(guide?.go).toEqual({ to: '/guide' });
  });

  test('a section with pages yields one row per page and none for itself', () => {
    expect(ids('Pages')).toEqual([
      'Pages:guide',
      'Pages:library/libraries',
      'Pages:library/fillers',
    ]);
  });

  test('hidden sections are left out', () => {
    expect(entries.some((e) => e.item.label === 'Welcome')).toBe(false);
  });

  test('settings pages are their own group', () => {
    expect(ids('Settings')).toEqual(['Settings:general', 'Settings:xmltv']);
  });

  test('ids are unique across groups', () => {
    const all = entries.map((e) => e.item.id);
    expect(new Set(all).size).toBe(all.length);
  });

  test('a channel row carries its number and route params', () => {
    const channel = entries.find((e) => e.item.group === 'Channels');
    expect(channel?.item.number).toBe('1');
    expect(channel?.go).toEqual({
      to: '/channels/$channelId',
      params: { channelId: 'c1' },
    });
  });
});

describe('paletteGroups', () => {
  test('an empty query lists only pages and settings', () => {
    expect(paletteGroups(entries, '  ').map((g) => g.name)).toEqual([
      'Pages',
      'Settings',
    ]);
  });

  test('entities appear once a query is typed', () => {
    expect(paletteGroups(entries, 'movie').map((g) => g.name)).toEqual([
      'Channels',
      'Custom Shows',
      'Filler Lists',
      'Smart Collections',
    ]);
  });
});

describe('searchLibraryTarget', () => {
  test('the term survives into the search query', () => {
    expect(searchLibraryTarget('Star Trek')).toEqual({
      to: '/search',
      search: { query: 'title ~ "Star Trek"' },
    });
  });

  test('a term with nothing searchable opens search without a query', () => {
    expect(searchLibraryTarget(' "{}" ')).toEqual({ to: '/search' });
  });
});
