import { tag } from '@tunarr/types';
import { v4 } from 'uuid';
import { describe, expect, test } from 'vitest';
import type { MediaSourceOtherVideo } from '../../types/Media.js';
import type { MediaSourceId, MediaSourceName } from '../schema/base.js';
import type { MediaSourceOrm } from '../schema/MediaSource.js';
import type { MediaSourceLibrary } from '../schema/MediaSourceLibrary.js';
import { ProgramDaoMinter } from './ProgramMinter.js';

const mediaSource = {
  uuid: tag<MediaSourceId>('media-source-1'),
  name: tag<MediaSourceName>('Local Videos'),
  type: 'local',
  uri: '/media',
  accessToken: '',
  index: 0,
  consecutiveAuthFailures: 0,
  clientIdentifier: null,
  createdAt: null,
  updatedAt: null,
  userId: null,
  username: null,
  mediaType: 'other_videos',
  sendChannelUpdates: false,
  sendGuideUpdates: false,
  sendPlayStatusUpdates: false,
} satisfies MediaSourceOrm;

const mediaLibrary = {
  uuid: 'library-1',
  name: 'Local Videos',
  mediaType: 'other_videos',
  mediaSourceId: tag<MediaSourceId>('media-source-1'),
  externalKey: '/media',
  enabled: true,
  lastScannedAt: null,
  unavailableSince: null,
} satisfies MediaSourceLibrary;

function makeOtherVideo(
  overrides: Partial<MediaSourceOtherVideo> = {},
): MediaSourceOtherVideo {
  return {
    uuid: v4(),
    sourceType: 'local',
    identifiers: [],
    title: 'Filler Clip',
    sortTitle: 'filler clip',
    originalTitle: null,
    year: null,
    releaseDate: null,
    releaseDateString: null,
    artwork: [],
    state: 'ok',
    type: 'other_video',
    summary: 'A plot from the NFO',
    plot: null,
    tagline: null,
    duration: 60_000,
    mediaSourceId: 'media-source-1',
    libraryId: 'library-1',
    canonicalId: 'canonical-1',
    externalId: '/media/filler.mkv',
    ...overrides,
  };
}

describe('ProgramDaoMinter.mintOtherVideo', () => {
  const minter = new ProgramDaoMinter();

  test('persists the summary on the program row', () => {
    const video = makeOtherVideo({ summary: 'A local NFO plot' });

    const { program } = minter.mintOtherVideo(mediaSource, mediaLibrary, video);

    expect(program.summary).toBe('A local NFO plot');
  });

  test('persists a null summary when the video has none', () => {
    const video = makeOtherVideo({ summary: null });

    const { program } = minter.mintOtherVideo(mediaSource, mediaLibrary, video);

    expect(program.summary).toBeNull();
  });
});
