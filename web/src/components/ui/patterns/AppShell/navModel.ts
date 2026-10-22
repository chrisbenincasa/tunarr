import type { router } from '@/router.ts';
import type { ReactNode } from 'react';

export type ShellPath = keyof (typeof router)['routesByPath'];

export type ShellNavBadge = {
  count: number;
  severity: 'warning' | 'error';
};

export type ShellNavPage = {
  id: string;
  label: string;
  to: ShellPath;

  // Without `exact`, the page also owns every path below `to`.
  exact?: boolean;
  alsoMatches?: string[];
};

export type ShellNavSection = {
  id: string;
  label: string;
  to: ShellPath;
  icon: ReactNode;
  pages: ShellNavPage[];
  hidden?: boolean;
  badge?: ShellNavBadge;
  alsoMatches?: string[];
};

// Settings is kept apart from the sections because the desktop bar shows it
// as a gear at the right end. The phone bottom bar treats it as one more item.
export type ShellNav = {
  sections: ShellNavSection[];
  settings: ShellNavSection;
};

export type ActiveNav = {
  sectionId?: string;
  pageId?: string;
};

// `/` would own every path as a prefix, so it only ever matches itself.
const ownsPath = (base: string, pathname: string, exact = false) =>
  exact || base === '/'
    ? pathname === base
    : pathname === base || pathname.startsWith(`${base}/`);

const normalize = (pathname: string) =>
  pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;

// The longest matching page wins, so `/system/logs` beats the exact-match
// `/system` status page and a section prefix.
export function resolveActiveNav(
  nav: ShellNav,
  rawPathname: string,
): ActiveNav {
  const pathname = normalize(rawPathname);
  let best: { sectionId: string; pageId?: string; length: number } | undefined;

  const consider = (
    sectionId: string,
    pageId: string | undefined,
    base: string,
    exact?: boolean,
  ) => {
    if (
      ownsPath(base, pathname, exact) &&
      (best === undefined || base.length > best.length)
    ) {
      best = { sectionId, pageId, length: base.length };
    }
  };

  for (const section of [...nav.sections, nav.settings]) {
    if (section.hidden) {
      continue;
    }

    // Pages go first so they win ties with their section's own path.
    for (const page of section.pages) {
      consider(section.id, page.id, page.to, page.exact);
      for (const extra of page.alsoMatches ?? []) {
        consider(section.id, page.id, extra);
      }
    }

    consider(section.id, undefined, section.to, section.pages.length > 0);
    for (const extra of section.alsoMatches ?? []) {
      consider(section.id, undefined, extra);
    }
  }

  return best === undefined
    ? {}
    : { sectionId: best.sectionId, pageId: best.pageId };
}

export const visibleSections = (nav: ShellNav) =>
  nav.sections.filter((section) => !section.hidden);

// A section with sub-pages is an ancestor of the current page, whose tab
// carries 'page'. A section without them is the page itself.
export const sectionAriaCurrent = (
  section: ShellNavSection,
  current: boolean,
): 'page' | 'location' | undefined => {
  if (!current) {
    return undefined;
  }

  return section.pages.length > 0 ? 'location' : 'page';
};

// The worst badge among the sections, for a control that stands in for them.
export const worstBadgeSeverity = (
  sections: ShellNavSection[],
): ShellNavBadge['severity'] | undefined => {
  const severities = sections.flatMap((s) =>
    s.badge ? [s.badge.severity] : [],
  );
  if (severities.includes('error')) {
    return 'error';
  }

  return severities.length > 0 ? 'warning' : undefined;
};
