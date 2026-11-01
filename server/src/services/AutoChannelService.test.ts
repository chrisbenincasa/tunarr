import type { ChannelDB } from '@/db/ChannelDB.js';
import type { SmartCollectionsDB } from '@/db/SmartCollectionsDB.js';
import type { TranscodeConfigDB } from '@/db/TranscodeConfigDB.js';
import type { TranscodeConfigOrm } from '@/db/schema/TranscodeConfig.js';
import { Result } from '@/types/result.js';
import type { AutoChannelCreateRequest } from '@tunarr/types/api';
import { describe, expect, test, vi } from 'vitest';
import { AutoChannelService } from './AutoChannelService.ts';
import type { MeilisearchService } from './MeilisearchService.ts';

vi.mock('@/services/Scheduler.js', () => ({
  GlobalScheduler: {
    getScheduledJob: () => ({ runNow: () => Promise.resolve() }),
  },
}));

vi.mock('@/db/converters/channelConverters.js', () => ({
  dbChannelToApiChannel: (channel: { uuid: string }) => ({ id: channel.uuid }),
}));

const DefaultConfigId = '5f0e7c2a-3b1d-4e8f-9a6c-1d2b3c4d5e6f';
const ChannelId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

type ServiceOptions = {
  defaultConfig?: Partial<TranscodeConfigOrm> | null;
  programs?: { id: string }[];
  existingNumbers?: number[];
  searchPages?: { type: string; duration?: number; id?: string }[][];
};

function makeService(opts: ServiceOptions = {}) {
  const defaultConfig =
    opts.defaultConfig === null
      ? undefined
      : (opts.defaultConfig ?? { uuid: DefaultConfigId });
  const programs = opts.programs ?? [{ id: 'p1' }, { id: 'p2' }];

  let collectionCount = 0;
  const smartCollectionsDB = {
    insert: vi.fn(() =>
      Promise.resolve(Result.success({ uuid: `coll-${++collectionCount}` })),
    ),
    materializeSmartCollection: vi.fn(() => Promise.resolve(programs)),
    delete: vi.fn(() => Promise.resolve()),
  };
  const channelDB = {
    getAllChannels: vi.fn(() =>
      Promise.resolve(
        (opts.existingNumbers ?? []).map((number) => ({ number })),
      ),
    ),
    saveChannel: vi.fn(() => Promise.resolve({ channel: { uuid: ChannelId } })),
    updateLineup: vi.fn(() => Promise.resolve()),
    deleteChannel: vi.fn(() => Promise.resolve()),
    loadChannelAndLineupOrm: vi.fn(() => Promise.resolve({ uuid: ChannelId })),
  };
  const transcodeConfigDB = {
    getDefaultConfig: vi.fn(() => Promise.resolve(defaultConfig)),
  };

  const pages = opts.searchPages ?? [];
  const searchService = {
    search: vi.fn((_index: string, req: { paging: { page: number } }) =>
      Promise.resolve({ results: pages[req.paging.page] ?? [] }),
    ),
  };

  const service = new AutoChannelService(
    searchService as unknown as MeilisearchService,
    smartCollectionsDB as unknown as SmartCollectionsDB,
    channelDB as unknown as ChannelDB,
    transcodeConfigDB as unknown as TranscodeConfigDB,
  );

  return { service, smartCollectionsDB, channelDB, searchService };
}

const shuffleRequest: AutoChannelCreateRequest = {
  presetId: '24-7-shuffle',
  contentAssignments: { all: { query: {} } },
  channelNumber: 7,
};

const weightedMixRequest = (
  queries: Record<
    string,
    AutoChannelCreateRequest['contentAssignments'][string]
  >,
): AutoChannelCreateRequest => ({
  presetId: 'weighted-mix',
  contentAssignments: queries,
  dynamicParams: {
    type: 'weighted_mix',
    groups: Object.keys(queries).map((role) => ({ role, weight: 1 })),
  },
});

describe('AutoChannelService.createChannel', () => {
  test('creates the collection, channel, and lineup', async () => {
    const { service, smartCollectionsDB, channelDB } = makeService();

    const channel = await service.createChannel(shuffleRequest);

    expect(channel).toEqual({ id: ChannelId });
    expect(smartCollectionsDB.insert).toHaveBeenCalledOnce();
    expect(channelDB.saveChannel).toHaveBeenCalledWith(
      expect.objectContaining({
        number: 7,
        transcodeConfigId: DefaultConfigId,
      }),
    );
    expect(channelDB.updateLineup).toHaveBeenCalledWith(
      ChannelId,
      expect.objectContaining({ programs: ['p1', 'p2'] }),
    );
    expect(smartCollectionsDB.delete).not.toHaveBeenCalled();
  });

  test('picks the lowest free channel number when none is given', async () => {
    const { service, channelDB } = makeService({ existingNumbers: [1, 2, 4] });

    await service.createChannel({
      ...shuffleRequest,
      channelNumber: undefined,
    });

    expect(channelDB.saveChannel).toHaveBeenCalledWith(
      expect.objectContaining({ number: 3 }),
    );
  });

  test('fails before writing anything when no default config exists', async () => {
    const { service, smartCollectionsDB, channelDB } = makeService({
      defaultConfig: null,
    });

    await expect(service.createChannel(shuffleRequest)).rejects.toThrow(
      'No default transcode config exists',
    );

    expect(smartCollectionsDB.insert).not.toHaveBeenCalled();
    expect(channelDB.saveChannel).not.toHaveBeenCalled();
  });

  test('rejects a taken channel number before writing anything', async () => {
    const { service, smartCollectionsDB, channelDB } = makeService({
      existingNumbers: [7],
    });

    await expect(service.createChannel(shuffleRequest)).rejects.toThrow(
      'Channel with number 7 already exists',
    );

    expect(smartCollectionsDB.insert).not.toHaveBeenCalled();
    expect(channelDB.saveChannel).not.toHaveBeenCalled();
  });

  test('rejects a missing required role before writing anything', async () => {
    const { service, smartCollectionsDB } = makeService();

    await expect(
      service.createChannel({ ...shuffleRequest, contentAssignments: {} }),
    ).rejects.toThrow('Missing content assignment');

    expect(smartCollectionsDB.insert).not.toHaveBeenCalled();
  });

  test('rejects an unparsable filter before writing anything', async () => {
    const { service, smartCollectionsDB } = makeService();

    await expect(
      service.createChannel({
        ...shuffleRequest,
        contentAssignments: { all: { query: { filterString: 'genre = (' } } },
      }),
    ).rejects.toThrow('Could not parse filter');

    expect(smartCollectionsDB.insert).not.toHaveBeenCalled();
  });

  test('rejects a dynamic role with an empty query', async () => {
    const { service, smartCollectionsDB } = makeService();

    await expect(
      service.createChannel(
        weightedMixRequest({
          group_1: { query: { filterString: 'genre = "Comedy"' } },
          group_2: { query: {} },
        }),
      ),
    ).rejects.toThrow('needs a content filter');

    expect(smartCollectionsDB.insert).not.toHaveBeenCalled();
  });

  test('accepts dynamic roles that each select content', async () => {
    const { service, smartCollectionsDB } = makeService();

    await service.createChannel(
      weightedMixRequest({
        group_1: { query: { filterString: 'genre = "Comedy"' } },
        group_2: { programIds: ['p9'] },
      }),
    );

    expect(smartCollectionsDB.insert).toHaveBeenCalledTimes(2);
  });

  test('deletes its collections when a role has too few programs', async () => {
    const { service, smartCollectionsDB, channelDB } = makeService({
      programs: [],
    });

    await expect(service.createChannel(shuffleRequest)).rejects.toThrow(
      'needs at least 1',
    );

    expect(smartCollectionsDB.delete).toHaveBeenCalledWith('coll-1');
    expect(channelDB.saveChannel).not.toHaveBeenCalled();
  });

  test('deletes the channel and collections when the lineup fails', async () => {
    const { service, smartCollectionsDB, channelDB } = makeService();
    channelDB.updateLineup.mockRejectedValueOnce(new Error('bad schedule'));

    await expect(service.createChannel(shuffleRequest)).rejects.toThrow(
      'bad schedule',
    );

    expect(channelDB.deleteChannel).toHaveBeenCalledWith(ChannelId);
    expect(smartCollectionsDB.delete).toHaveBeenCalledWith('coll-1');
  });
});

describe('AutoChannelService.previewContent', () => {
  test('counts only terminal programs', async () => {
    const { service } = makeService({
      searchPages: [
        [
          { id: 'm1', type: 'movie', duration: 1000 },
          { id: 's1', type: 'show' },
          { id: 'e1', type: 'episode', duration: 500 },
        ],
      ],
    });

    const preview = await service.previewContent({});

    expect(preview.totalPrograms).toBe(2);
    expect(preview.totalDurationMs).toBe(1500);
    expect(preview.byType).toMatchObject({ movie: 1, episode: 1, track: 0 });
    expect(preview.sampleIds).toEqual(['m1', 'e1']);
  });

  test('scopes the search filter to the query', async () => {
    const { service, searchService } = makeService();

    await service.previewContent({
      filterString: 'genre = "Comedy"',
      programTypes: ['movie'],
    });

    const filter = searchService.search.mock.calls[0]?.[1];
    expect(filter).toMatchObject({
      filter: {
        type: 'op',
        op: 'and',
        children: [
          { type: 'value', fieldSpec: { key: 'genres.name' } },
          { type: 'value', fieldSpec: { key: 'type', value: ['movie'] } },
        ],
      },
    });
  });

  test('stops paging at 10,000 results', async () => {
    const page = Array.from({ length: 100 }, (_, i) => ({
      id: `m${i}`,
      type: 'movie',
      duration: 1,
    }));
    const { service, searchService } = makeService({
      searchPages: Array.from({ length: 200 }, () => page),
    });

    const preview = await service.previewContent({});

    expect(searchService.search).toHaveBeenCalledTimes(100);
    expect(preview.totalPrograms).toBe(10_000);
  });
});
