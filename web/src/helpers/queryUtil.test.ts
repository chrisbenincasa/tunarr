import { QueryClient } from '@tanstack/react-query';
import { describe, expect, test } from 'vitest';
import {
  getApiChannelsAllLineupsQueryKey,
  getApiChannelsByIdLineupQueryKey,
  getApiChannelsByIdNowPlayingQueryKey,
  getApiChannelsByIdProgrammingQueryKey,
  getApiProgramGroupingsByIdQueryKey,
  getApiProgramsByIdQueryKey,
  getApiSystemDebugEnvQueryKey,
  getApiXmltvSettingsQueryKey,
  getChannelsQueryKey,
} from '../generated/@tanstack/react-query.gen.ts';
import { invalidateTaggedQueries } from './queryUtil.ts';

/**
 * Generated hey-api query keys are a single-element array whose element is an
 * object: `[{ _id, baseURL, tags }]`. A hand-written string key such as
 * `['Channels']` therefore diverges at element 0 and prefix-matches nothing --
 * `'Channels'` is the *tag*, not a key segment.
 *
 * These tests drive a real QueryClient rather than reimplementing the matcher,
 * so they stay true if TanStack changes how matching works.
 */
const seed = (client: QueryClient, key: readonly unknown[]) => {
  client.setQueryData(key, { seeded: true });
  const query = client.getQueryCache().find({ queryKey: key });
  if (!query) {
    throw new Error('failed to seed query into the cache');
  }
  return query;
};

describe('generated query keys', () => {
  test('a bare tag string does not match the query it names', async () => {
    const client = new QueryClient();
    const query = seed(client, getChannelsQueryKey());

    await client.invalidateQueries({ queryKey: ['Channels'] });

    expect(query.state.isInvalidated).toBe(false);
  });

  test('invalidateTaggedQueries matches it', async () => {
    const client = new QueryClient();
    const query = seed(client, getChannelsQueryKey());

    await client.invalidateQueries({
      predicate: invalidateTaggedQueries('Channels'),
    });

    expect(query.state.isInvalidated).toBe(true);
  });

  test('the generated key factory matches it exactly', async () => {
    const client = new QueryClient();
    const query = seed(client, getChannelsQueryKey());

    await client.invalidateQueries({ queryKey: getChannelsQueryKey() });

    expect(query.state.isInvalidated).toBe(true);
  });
});

describe('invalidateTaggedQueries', () => {
  test('does not match a query carrying a different tag', async () => {
    const client = new QueryClient();
    const channels = seed(client, getChannelsQueryKey());
    const settings = seed(client, getApiXmltvSettingsQueryKey());

    await client.invalidateQueries({
      predicate: invalidateTaggedQueries('Settings'),
    });

    expect(settings.state.isInvalidated).toBe(true);
    expect(channels.state.isInvalidated).toBe(false);
  });

  test('matches when any one of several tags matches', async () => {
    const client = new QueryClient();
    const query = seed(client, getChannelsQueryKey());

    await client.invalidateQueries({
      predicate: invalidateTaggedQueries(['Guide', 'Channels']),
    });

    expect(query.state.isInvalidated).toBe(true);
  });

  test('matches nothing when given no tags', async () => {
    const client = new QueryClient();
    const query = seed(client, getChannelsQueryKey());

    await client.invalidateQueries({ predicate: invalidateTaggedQueries([]) });

    expect(query.state.isInvalidated).toBe(false);
  });

  test('ignores hand-written string keys, which carry no tags', async () => {
    const client = new QueryClient();
    const query = seed(client, ['channels', 'abc', 'now_playing']);

    await client.invalidateQueries({
      predicate: invalidateTaggedQueries('Channels'),
    });

    expect(query.state.isInvalidated).toBe(false);
  });
});

/**
 * Pins each invalidation site to the query it exists to refresh.
 *
 * Every one of these was dead before: a hand-written string key, or a
 * hand-rolled predicate, aimed at a generated key it could never match. The
 * risk in fixing them by tag is picking a tag that is equally wrong -- the TV
 * Guide case nearly went out invalidating the 'Guide' tag, which belongs to
 * endpoints that page never calls. This table is the check.
 */
describe('invalidation sites reach their targets', () => {
  const cases: {
    site: string;
    tag: string;
    targets: readonly (readonly unknown[])[];
  }[] = [
    {
      site: 'useCreateChannel / ChannelsPage delete + stream events',
      tag: 'Channels',
      targets: [getChannelsQueryKey()],
    },
    {
      site: 'TvGuide on xmltv regeneration',
      tag: 'Channels',
      targets: [
        getApiChannelsByIdLineupQueryKey({ path: { id: 'c1' } }),
        getApiChannelsAllLineupsQueryKey(),
      ],
    },
    {
      site: 'useUpdateLineup after saving programming',
      tag: 'Channels',
      targets: [getApiChannelsByIdProgrammingQueryKey({ path: { id: 'c1' } })],
    },
    {
      site: 'XmlTvSettingsPage after save',
      tag: 'Settings',
      targets: [getApiXmltvSettingsQueryKey()],
    },
    {
      site: 'SystemDebugPage on server lifecycle events',
      tag: 'System',
      targets: [getApiSystemDebugEnvQueryKey()],
    },
    {
      site: 'useScanNow after a rescan',
      tag: 'Programs',
      targets: [
        getApiProgramsByIdQueryKey({ path: { id: 'p1' } }),
        getApiProgramGroupingsByIdQueryKey({ path: { id: 'p1' } }),
      ],
    },
  ];

  test.each(cases)(
    '$site invalidates via the $tag tag',
    async ({ tag, targets }) => {
      const client = new QueryClient();
      const queries = targets.map((key) => seed(client, key));

      await client.invalidateQueries({
        predicate: invalidateTaggedQueries(tag),
      });

      for (const query of queries) {
        expect(query.state.isInvalidated).toBe(true);
      }
    },
  );

  test('ChannelNowPlayingCard invalidates exactly its own query', async () => {
    const client = new QueryClient();
    const mine = seed(
      client,
      getApiChannelsByIdNowPlayingQueryKey({ path: { id: 'c1' } }),
    );
    const other = seed(
      client,
      getApiChannelsByIdNowPlayingQueryKey({ path: { id: 'c2' } }),
    );

    await client.invalidateQueries({
      queryKey: getApiChannelsByIdNowPlayingQueryKey({ path: { id: 'c1' } }),
    });

    expect(mine.state.isInvalidated).toBe(true);
    expect(other.state.isInvalidated).toBe(false);
  });
});
