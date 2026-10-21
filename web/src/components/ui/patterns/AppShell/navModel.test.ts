import { describe, expect, test } from 'vitest';
import {
  resolveActiveNav,
  sectionAriaCurrent,
  type ShellNav,
  type ShellNavSection,
  worstBadgeSeverity,
} from './navModel.ts';

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
    {
      id: 'guide',
      label: 'Guide',
      to: '/guide',
      icon: null,
      pages: [],
      alsoMatches: ['/'],
    },
    {
      id: 'channels',
      label: 'Channels',
      to: '/channels',
      icon: null,
      pages: [],
    },
    {
      id: 'library',
      label: 'Library',
      to: '/library',
      icon: null,
      pages: [
        {
          id: 'libraries',
          label: 'Libraries',
          to: '/library',
          exact: true,
          alsoMatches: ['/media_sources'],
        },
        { id: 'fillers', label: 'Filler Lists', to: '/library/fillers' },
      ],
    },
    {
      id: 'system',
      label: 'System',
      to: '/system',
      icon: null,
      pages: [
        { id: 'status', label: 'Status', to: '/system', exact: true },
        { id: 'logs', label: 'Logs', to: '/system/logs' },
      ],
    },
  ],
  settings: {
    id: 'settings',
    label: 'Settings',
    to: '/settings/general',
    icon: null,
    alsoMatches: ['/settings'],
    pages: [
      { id: 'general', label: 'General', to: '/settings/general' },
      { id: 'ffmpeg', label: 'FFmpeg', to: '/settings/ffmpeg' },
    ],
  },
};

describe('resolveActiveNav', () => {
  test.each([
    ['/', 'guide', undefined],
    ['/guide', 'guide', undefined],
    ['/channels/abc/programming', 'channels', undefined],
    ['/library', 'library', 'libraries'],
    ['/library/', 'library', 'libraries'],
    ['/library/fillers/123/edit', 'library', 'fillers'],
    ['/media_sources/abc/libraries/def', 'library', 'libraries'],
    ['/system', 'system', 'status'],
    ['/system/logs', 'system', 'logs'],
    ['/settings', 'settings', undefined],
    ['/settings/ffmpeg/some-config', 'settings', 'ffmpeg'],
  ])('%s is in %s / %s', (pathname, sectionId, pageId) => {
    expect(resolveActiveNav(nav, pathname)).toEqual({ sectionId, pageId });
  });

  test('a prefix match needs a path boundary', () => {
    expect(resolveActiveNav(nav, '/systemx')).toEqual({});
  });

  test('hidden sections never match', () => {
    expect(resolveActiveNav(nav, '/welcome')).toEqual({});
  });

  test('paths outside every section match nothing', () => {
    expect(resolveActiveNav(nav, '/search')).toEqual({});
  });
});

describe('sectionAriaCurrent', () => {
  const [, guide, , library] = nav.sections;

  test('a current section without pages is the page', () => {
    expect(sectionAriaCurrent(guide, true)).toBe('page');
  });

  test('a current section with pages is only the location', () => {
    expect(sectionAriaCurrent(library, true)).toBe('location');
    expect(sectionAriaCurrent(nav.settings, true)).toBe('location');
  });

  test('a section that is not current claims nothing', () => {
    expect(sectionAriaCurrent(library, false)).toBeUndefined();
  });
});

describe('worstBadgeSeverity', () => {
  const withBadge = (severity?: 'warning' | 'error'): ShellNavSection => ({
    id: severity ?? 'none',
    label: '',
    to: '/guide',
    icon: null,
    pages: [],
    badge: severity ? { count: 1, severity } : undefined,
  });

  test('no badges means no dot', () => {
    expect(worstBadgeSeverity([withBadge()])).toBeUndefined();
  });

  test('warnings alone stay warnings', () => {
    expect(worstBadgeSeverity([withBadge(), withBadge('warning')])).toBe(
      'warning',
    );
  });

  test('any error wins', () => {
    expect(worstBadgeSeverity([withBadge('warning'), withBadge('error')])).toBe(
      'error',
    );
  });
});
