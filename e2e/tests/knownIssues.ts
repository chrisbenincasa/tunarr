// Page problems that existed when the sweep was introduced (09/29/2026).
// Each entry applies only to the routes it lists, so the same warning on a
// new route still fails. Delete an entry once its cause is fixed.

type KnownIssue = {
  match: RegExp;
  routes: string[] | 'all';
  note: string;
};

export const KNOWN_ISSUES: KnownIssue[] = [
  {
    match: /reading 'pendingMatches'.*TanStackRouterDevtoolsPanel/,
    routes: 'all',
    note: 'Router devtools 1.166 runs on router-core 1.171 while the app runs react-router 1.133. Clears when the router family is upgraded as a set.',
  },
  {
    match: /\/api\/programs\/[^/]+\/artwork\//,
    routes: 'all',
    note: 'Fixture media ships without artwork, so artwork requests 404.',
  },
  {
    match:
      /Cannot update a component \(`%s`\) while rendering a different component/,
    routes: [
      '/channels',
      '/channels/$channelId/programming/slot-editor',
      '/library',
      '/library/custom-shows',
      '/library/fillers',
      '/library/smart_collections',
      '/media_sources',
      '/settings/ffmpeg',
      '/settings/sources',
    ],
    note: 'setState during render. The shared cause is likely in a table or layout component these pages use.',
  },
  {
    match: /Each child in a list should have a unique \\?"key\\?" prop/,
    routes: [
      '/channels/$channelId/programming',
      '/channels/$channelId/programming/slot-editor',
      '/channels/$channelId/programming/time-slot-editor',
      '/library/custom-shows/$showId/edit',
      '/library/fillers/$fillerId/edit',
    ],
    note: 'Missing list keys in the lineup and programming editors.',
  },
  {
    match: /MUI: The `value` provided to the Tabs component is invalid/,
    routes: ['/settings', '/settings/sources'],
    note: 'Settings tabs receive a value with no matching tab.',
  },
  {
    match: /Invalid prop `children` supplied to `ForwardRef\(Tooltip2?\)`/,
    routes: ['/channels'],
    note: 'Tooltip wraps a component that cannot hold a ref.',
  },
  {
    match: /Function components cannot be given refs/,
    routes: ['/channels'],
    note: 'Same Tooltip child as above.',
  },
];

export function knownIssuesFor(routePath: string): RegExp[] {
  return KNOWN_ISSUES.filter(
    (issue) => issue.routes === 'all' || issue.routes.includes(routePath),
  ).map((issue) => issue.match);
}
