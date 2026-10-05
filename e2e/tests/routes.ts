import { readFileSync } from 'node:fs';
import path from 'node:path';
import { FIXTURE_IDS_FILE, REPO_ROOT } from '../fixture/env.ts';
import type { FixtureIds } from '../fixture/seed.ts';

type UrlsFor = (ids: FixtureIds) => string[];

// `broken` routes run under test.fail(). They pass while the bug exists and
// fail once it is fixed, which is the cue to drop the wrapper.
export type RouteTarget =
  | UrlsFor
  | { skip: string }
  | { broken: string; urls: UrlsFor };

const first = (ids: string[]) => {
  const [id] = ids;
  if (id === undefined) {
    throw new Error('Fixture has no channels');
  }
  return id;
};

const eachChannel =
  (suffix: string) =>
  (ids: FixtureIds): string[] =>
    ids.channelIds.map((id) => `/channels/${id}${suffix}`);

// Every full path in web/src/routeTree.gen.ts must appear here, either with
// the URLs to visit or with a reason to skip. The coverage test enforces
// this, so a new route fails the sweep until someone maps it.
export const ROUTES: Record<string, RouteTarget> = {
  '/': () => ['/'],
  '/guide': () => ['/guide'],
  '/search': () => ['/search'],
  '/settings': () => ['/settings'],
  '/settings/features': () => ['/settings/features'],
  '/settings/ffmpeg': () => ['/settings/ffmpeg'],
  '/settings/ffmpeg/new': () => ['/settings/ffmpeg/new'],
  '/settings/ffmpeg/$configId': (ids) => [
    `/settings/ffmpeg/${ids.transcodeConfigId}`,
  ],
  '/settings/general': () => ['/settings/general'],
  '/settings/hdhr': () => ['/settings/hdhr'],
  '/settings/scanner': () => ['/settings/scanner'],
  '/settings/sources': () => ['/settings/sources'],
  '/settings/xmltv': () => ['/settings/xmltv'],
  '/system': () => ['/system'],
  '/system/': () => ['/system/'],
  '/system/debug': () => ['/system/debug'],
  '/system/logs': () => ['/system/logs'],
  '/system/tasks': () => ['/system/tasks'],
  '/system/troubleshoot': () => ['/system/troubleshoot'],
  '/welcome': () => ['/welcome'],

  '/channels': () => ['/channels'],
  '/channels/new': () => ['/channels/new'],
  '/channels/test': { skip: 'Placeholder route that renders static text' },
  '/channels/$channelId': eachChannel(''),
  '/channels/$channelId/': eachChannel('/'),
  '/channels/$channelId/edit': eachChannel('/edit'),
  '/channels/$channelId/watch': (ids) => [
    `/channels/${first(ids.channelIds)}/watch`,
  ],
  '/channels/$channelId/programming': eachChannel('/programming'),
  '/channels/$channelId/programming/add': (ids) => [
    `/channels/${first(ids.channelIds)}/programming/add`,
  ],
  '/channels/$channelId/programming/slot-editor': (ids) => [
    `/channels/${first(ids.channelIds)}/programming/slot-editor`,
  ],
  '/channels/$channelId/programming/time-slot-editor': (ids) => [
    `/channels/${first(ids.channelIds)}/programming/time-slot-editor`,
  ],

  '/library': () => ['/library'],
  '/library/custom-shows': () => ['/library/custom-shows'],
  '/library/custom-shows/new': () => ['/library/custom-shows/new'],
  '/library/custom-shows/new/': () => ['/library/custom-shows/new/'],
  '/library/custom-shows/new/programming': () => [
    '/library/custom-shows/new/programming',
  ],
  '/library/custom-shows/$showId': (ids) => [
    `/library/custom-shows/${ids.customShowId}`,
  ],
  '/library/custom-shows/$showId/edit': (ids) => [
    `/library/custom-shows/${ids.customShowId}/edit`,
  ],
  '/library/custom-shows/$showId/programming': (ids) => [
    `/library/custom-shows/${ids.customShowId}/programming`,
  ],
  '/library/fillers': () => ['/library/fillers'],
  '/library/fillers/new': () => ['/library/fillers/new'],
  '/library/fillers/new/': () => ['/library/fillers/new/'],
  '/library/fillers/new/programming': () => [
    '/library/fillers/new/programming',
  ],
  '/library/fillers/$fillerId': (ids) => [
    `/library/fillers/${ids.fillerListId}`,
  ],
  '/library/fillers/$fillerId/edit': (ids) => [
    `/library/fillers/${ids.fillerListId}/edit`,
  ],
  '/library/fillers/$fillerId/programming': (ids) => [
    `/library/fillers/${ids.fillerListId}/programming`,
  ],
  '/library/smart_collections': () => ['/library/smart_collections'],
  '/library/smart_collections/$id': (ids) => [
    `/library/smart_collections/${ids.smartCollectionId}`,
  ],
  '/library/trash': () => ['/library/trash'],

  '/media/$programType/$programId': (ids) => [
    `/media/movie/${ids.movieId}`,
    `/media/episode/${ids.episodeId}`,
    `/media/show/${ids.showId}`,
  ],
  '/media_sources': () => ['/media_sources'],
  '/media_sources/$mediaSourceId': (ids) => [
    `/media_sources/${ids.mediaSourceId}`,
  ],
  '/media_sources/$mediaSourceId/libraries/$libraryId': {
    broken:
      'GET /api/media-libraries/:id returns 500 for local libraries (#2200).',
    urls: (ids) => [
      `/media_sources/${ids.mediaSourceId}/libraries/${ids.libraryId}`,
    ],
  },
};

export function generatedRoutePaths(): string[] {
  const source = readFileSync(
    path.join(REPO_ROOT, 'web/src/routeTree.gen.ts'),
    'utf8',
  );
  const union = /fullPaths:((?:\s*\|\s*'[^']*')+)/.exec(source)?.[1];
  if (union === undefined) {
    throw new Error('Could not find fullPaths in routeTree.gen.ts');
  }
  return [...union.matchAll(/'([^']*)'/g)].flatMap((m) =>
    m[1] === undefined ? [] : [m[1]],
  );
}

export function readFixtureIds(): FixtureIds {
  return JSON.parse(readFileSync(FIXTURE_IDS_FILE, 'utf8')) as FixtureIds;
}
