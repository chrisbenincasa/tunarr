import { faker } from '@faker-js/faker';
import { tag } from '@tunarr/types';
import { expect } from 'vitest';
import type { StreamLineupProgram } from '../db/derived_types/StreamLineup.ts';
import type {
  OfflineStreamLineupItem,
  ProgramStreamLineupItem,
  RedirectStreamLineupItem,
} from '../db/derived_types/StreamLineup.ts';
import type { MediaSourceId, MediaSourceName } from '../db/schema/base.ts';
import { mapLineupItemToPlaybackItem } from './nativePlaybackApi.ts';

function makeProgram(
  overrides?: Partial<StreamLineupProgram>,
): StreamLineupProgram {
  return {
    uuid: faker.string.uuid(),
    duration: 30 * 60 * 1000,
    title: faker.music.songName(),
    showTitle: null,
    episode: null,
    seasonNumber: null,
    summary: null,
    icon: null,
    createdAt: null,
    updatedAt: null,
    albumName: null,
    albumUuid: null,
    artistName: null,
    artistUuid: null,
    canonicalId: null,
    episodeIcon: null,
    externalKey: faker.string.alphanumeric(8),
    externalSourceId: tag<MediaSourceName>(faker.string.alphanumeric(6)),
    mediaSourceId: tag<MediaSourceId>(faker.string.uuid()),
    libraryId: null,
    localMediaFolderId: null,
    localMediaSourcePathId: null,
    filePath: null,
    grandparentExternalKey: null,
    originalAirDate: null,
    parentExternalKey: null,
    plexFilePath: null,
    plexRatingKey: null,
    rating: null,
    seasonIcon: null,
    seasonUuid: null,
    showIcon: null,
    sourceType: 'plex',
    tagline: null,
    tvShowUuid: null,
    type: 'movie',
    year: null,
    state: 'ok',
    externalIds: [],
    ...overrides,
  } satisfies StreamLineupProgram;
}

function makeProgramItem(
  programOverrides?: Partial<StreamLineupProgram>,
  itemOverrides?: Partial<ProgramStreamLineupItem>,
): ProgramStreamLineupItem {
  return {
    type: 'program',
    program: makeProgram(programOverrides),
    streamDuration: 30 * 60 * 1000,
    duration: 30 * 60 * 1000,
    programBeginMs: Date.now() - 5 * 60 * 1000,
    startOffset: 5 * 60 * 1000,
    infiniteLoop: false,
    ...itemOverrides,
  };
}

describe('mapLineupItemToPlaybackItem', () => {
  const baseUrl = 'http://localhost:8000';
  const channelId = faker.string.uuid();

  test('movie content item: title from program.title, no episodeTitle', () => {
    const programTitle = 'Inception';
    const item = makeProgramItem({ title: programTitle, showTitle: null });

    const result = mapLineupItemToPlaybackItem(item, baseUrl, channelId);

    expect(result.kind).toBe('content');
    if (result.kind === 'content') {
      expect(result.title).toBe(programTitle);
      expect(result.episodeTitle).toBeUndefined();
    }
  });

  test('TV episode: title from showTitle, episodeTitle from program.title', () => {
    const showTitle = 'Breaking Bad';
    const episodeTitle = 'Pilot';
    const item = makeProgramItem({
      title: episodeTitle,
      showTitle,
      type: 'episode',
    });

    const result = mapLineupItemToPlaybackItem(item, baseUrl, channelId);

    expect(result.kind).toBe('content');
    if (result.kind === 'content') {
      expect(result.title).toBe(showTitle);
      expect(result.episodeTitle).toBe(episodeTitle);
    }
  });

  test('content item maps season and episode numbers', () => {
    const item = makeProgramItem({
      type: 'episode',
      showTitle: 'The Office',
      seasonNumber: 2,
      episode: 3,
    });

    const result = mapLineupItemToPlaybackItem(item, baseUrl, channelId);

    expect(result.kind).toBe('content');
    if (result.kind === 'content') {
      expect(result.seasonNumber).toBe(2);
      expect(result.episodeNumber).toBe(3);
    }
  });

  test('content item seekOffsetMs uses startOffset when present', () => {
    const seekMs = 5 * 60 * 1000;
    const item = makeProgramItem({}, { startOffset: seekMs });

    const result = mapLineupItemToPlaybackItem(item, baseUrl, channelId);

    expect(result.kind).toBe('content');
    if (result.kind === 'content') {
      expect(result.seekOffsetMs).toBe(seekMs);
    }
  });

  test('content item seekOffsetMs defaults to 0 when startOffset is missing', () => {
    const item = makeProgramItem({}, { startOffset: undefined });

    const result = mapLineupItemToPlaybackItem(item, baseUrl, channelId);

    expect(result.kind).toBe('content');
    if (result.kind === 'content') {
      expect(result.seekOffsetMs).toBe(0);
    }
  });

  test('content item streamUrl points to item-stream.ts with t param', () => {
    const itemStartedAtMs = Date.now() - 60_000;
    const item = makeProgramItem({}, { programBeginMs: itemStartedAtMs });

    const result = mapLineupItemToPlaybackItem(item, baseUrl, channelId);

    expect(result.kind).toBe('content');
    if (result.kind === 'content') {
      expect(result.streamUrl).toBe(
        `${baseUrl}/stream/channels/${channelId}/item-stream.ts?t=${itemStartedAtMs}`,
      );
    }
  });

  test('content item maps thumb from program.icon', () => {
    const iconUrl = 'https://example.com/thumb.jpg';
    const item = makeProgramItem({ icon: iconUrl });

    const result = mapLineupItemToPlaybackItem(item, baseUrl, channelId);

    expect(result.kind).toBe('content');
    if (result.kind === 'content') {
      expect(result.thumb).toBe(iconUrl);
    }
  });

  test('offline item maps to flex kind', () => {
    const offline: OfflineStreamLineupItem = {
      type: 'offline',
      streamDuration: 10 * 60 * 1000,
      duration: 10 * 60 * 1000,
      programBeginMs: Date.now(),
    };

    const result = mapLineupItemToPlaybackItem(offline, baseUrl, channelId);

    expect(result.kind).toBe('flex');
    if (result.kind === 'flex') {
      expect(result.remainingMs).toBe(offline.streamDuration);
      expect(result.itemStartedAtMs).toBe(offline.programBeginMs);
    }
  });

  test('redirect item falls through as flex kind', () => {
    const redirect: RedirectStreamLineupItem = {
      type: 'redirect',
      channel: faker.string.uuid(),
      streamDuration: 5 * 60 * 1000,
      duration: 5 * 60 * 1000,
      programBeginMs: Date.now(),
    };

    const result = mapLineupItemToPlaybackItem(redirect, baseUrl, channelId);

    expect(result.kind).toBe('flex');
  });
});
