import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import type {
  CreateChannelV2Data,
  CreateCustomShowData,
  CreateCustomShowResponse,
  GetApiMediaLibrariesByLibraryIdProgramsResponse,
  GetApiMediaSourcesResponse,
  CreateChannelV2Response,
  GetApiTranscodeConfigsResponse,
  PostApiChannelsByIdProgrammingData,
  PostApiFillerListsData,
  PostApiFillerListsResponse,
  PostApiMediaSourcesData,
  PostApiMediaSourcesResponse,
  PostApiSmartCollectionsData,
  PostApiSmartCollectionsResponse,
} from '../../web/src/generated/types.gen.ts';
import { api } from './api.ts';
import { FIXTURE_IDS_FILE } from './env.ts';
import { FILLER_DIR, MOVIES_DIR, SHOWS_DIR } from './media.ts';

type NewChannel = Extract<
  NonNullable<CreateChannelV2Data['body']>,
  { type: 'new' }
>['channel'];
type LineupItem = Extract<
  NonNullable<PostApiChannelsByIdProgrammingData['body']>,
  { type: 'manual' }
>['lineup'][number];
type LibraryProgram = GetApiMediaLibrariesByLibraryIdProgramsResponse[number];

export type FixtureIds = {
  mediaSourceId: string;
  libraryId: string;
  channelIds: string[];
  customShowId: string;
  fillerListId: string;
  smartCollectionId: string;
  transcodeConfigId: string;
  movieId: string;
  episodeId: string;
  showId: string;
};

const SCAN_TIMEOUT_MS = 60_000;

async function addLocalSource(
  name: string,
  mediaType: 'movies' | 'shows' | 'other_videos',
  dir: string,
) {
  const body: NonNullable<PostApiMediaSourcesData['body']> = {
    type: 'local',
    name,
    mediaType,
    paths: [dir],
    pathReplacements: [],
  };
  const { id } = await api<PostApiMediaSourcesResponse>(
    'POST',
    '/media-sources',
    body,
  );
  return id;
}

// Creating a local source starts its scan. Poll until each library reports
// the expected number of programs.
async function waitForPrograms(sourceId: string, expected: number) {
  const deadline = Date.now() + SCAN_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const sources = await api<GetApiMediaSourcesResponse>(
      'GET',
      '/media-sources',
    );
    const library = sources.find((s) => s.id === sourceId)?.libraries[0];
    if (
      library !== undefined &&
      library.lastScannedAt !== undefined &&
      !library.isLocked
    ) {
      const programs = await api<LibraryProgram[]>(
        'GET',
        `/media-libraries/${library.id}/programs`,
      );
      if (programs.length >= expected) {
        return { libraryId: library.id, programs };
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    `Media source ${sourceId} did not reach ${expected} programs within ${SCAN_TIMEOUT_MS}ms`,
  );
}

function newChannel(
  number: number,
  name: string,
  transcodeConfigId: string,
  fillerListId?: string,
): NewChannel {
  return {
    id: randomUUID(),
    number,
    name,
    groupTitle: 'tunarr',
    duration: 0,
    startTime: Date.now() - 60 * 60 * 1000,
    stealth: false,
    disableFillerOverlay: false,
    guideMinimumDuration: 30_000,
    icon: { path: '', width: 0, duration: 0, position: 'bottom-right' },
    offline: { mode: 'pic' },
    streamMode: 'hls',
    transcodeConfigId,
    subtitlesEnabled: false,
    fillerCollections:
      fillerListId === undefined
        ? []
        : [{ id: fillerListId, weight: 100, cooldownSeconds: 0 }],
  };
}

// The server assigns its own channel ID, so callers use the returned one.
async function createChannel(channel: NewChannel, lineup: LineupItem[]) {
  const created = await api<CreateChannelV2Response>('POST', '/channels', {
    type: 'new',
    channel,
  });
  await api('POST', `/channels/${created.id}/programming`, {
    type: 'manual',
    lineup,
  } satisfies PostApiChannelsByIdProgrammingData['body']);
  return created;
}

function contentItem(program: LibraryProgram): LineupItem {
  return { type: 'content', id: program.id, duration: program.duration };
}

export async function seed(): Promise<FixtureIds> {
  const moviesSourceId = await addLocalSource(
    'E2E Movies',
    'movies',
    MOVIES_DIR,
  );
  const showsSourceId = await addLocalSource('E2E Shows', 'shows', SHOWS_DIR);
  const fillerSourceId = await addLocalSource(
    'E2E Filler',
    'other_videos',
    FILLER_DIR,
  );

  const movies = await waitForPrograms(moviesSourceId, 3);
  const episodes = await waitForPrograms(showsSourceId, 6);
  const bumpers = await waitForPrograms(fillerSourceId, 2);

  const [transcodeConfig] = await api<GetApiTranscodeConfigsResponse>(
    'GET',
    '/transcode_configs',
  );
  if (transcodeConfig === undefined) {
    throw new Error('Server started without a default transcode config');
  }

  const customShow = await api<CreateCustomShowResponse>(
    'POST',
    '/custom-shows',
    {
      name: 'E2E Reruns',
      programs: episodes.programs.slice(0, 3).map((p) => ({
        type: 'content',
        id: p.id,
        duration: p.duration,
      })),
      syncMediaSourceId: null,
      syncMediaSourceType: null,
      syncExternalPlaylistId: null,
    } satisfies CreateCustomShowData['body'],
  );

  const fillerList = await api<PostApiFillerListsResponse>(
    'POST',
    '/filler-lists',
    {
      name: 'E2E Bumpers',
      programs: bumpers.programs,
    } satisfies PostApiFillerListsData['body'],
  );

  const smartCollection = await api<PostApiSmartCollectionsResponse>(
    'POST',
    '/smart_collections',
    {
      name: 'E2E Movies Only',
      filterString: 'type:movie',
      keywords: '',
    } satisfies PostApiSmartCollectionsData['body'],
  );

  // Three channels with different lineup shapes: mixed item types,
  // plain episodes, and a redirect.
  const mixed = newChannel(1, 'E2E Mixed', transcodeConfig.id, fillerList.id);
  const [firstEpisode] = episodes.programs;
  if (firstEpisode === undefined) {
    throw new Error('Shows library scanned with no episodes');
  }
  const mixedChannel = await createChannel(mixed, [
    ...movies.programs.map(contentItem),
    { type: 'flex', duration: 30_000 },
    {
      type: 'custom',
      id: firstEpisode.id,
      duration: firstEpisode.duration,
      customShowId: customShow.id,
      index: 0,
    },
  ]);

  const episodic = newChannel(2, 'E2E Episodes', transcodeConfig.id);
  const episodicChannel = await createChannel(
    episodic,
    episodes.programs.map(contentItem),
  );

  const redirect = newChannel(3, 'E2E Redirect', transcodeConfig.id);
  const redirectChannel = await createChannel(redirect, [
    { type: 'flex', duration: 60_000 },
    {
      type: 'redirect',
      duration: 5 * 60_000,
      channel: mixedChannel.id,
      channelNumber: mixedChannel.number,
      channelName: mixedChannel.name,
    },
  ]);

  const [movie] = movies.programs;
  if (movie === undefined || firstEpisode.program.type !== 'episode') {
    throw new Error('Fixture media did not scan as expected');
  }
  const showId = firstEpisode.program.show?.uuid;
  if (showId === undefined) {
    throw new Error('Scanned episode has no parent show');
  }

  return {
    mediaSourceId: moviesSourceId,
    libraryId: movies.libraryId,
    channelIds: [mixedChannel.id, episodicChannel.id, redirectChannel.id],
    customShowId: customShow.id,
    fillerListId: fillerList.id,
    smartCollectionId: smartCollection.uuid,
    transcodeConfigId: transcodeConfig.id,
    movieId: movie.id,
    episodeId: firstEpisode.id,
    showId,
  };
}

export function writeFixtureIds(ids: FixtureIds) {
  writeFileSync(FIXTURE_IDS_FILE, JSON.stringify(ids, null, 2));
}
