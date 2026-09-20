import { describe, expect, test, vi } from 'vitest';
import type { StreamLineupItem } from '../../db/derived_types/StreamLineup.ts';
import type { ChannelOrmWithTranscodeConfig } from '../../db/schema/derivedTypes.ts';
import { Result } from '../../types/result.ts';
import { FileStreamSource } from '../types.ts';
import {
  EtvNextPlayoutWriter,
  MaxItemsPerWindow,
} from './EtvNextPlayoutWriter.ts';
import { PlayoutItemSchema } from './generated/playout.ts';

const startMs = Date.parse('2026-02-23T20:00:00.000-05:00');

const channel = {
  uuid: 'chan-1',
  offline: { mode: 'pic', picture: '/media/offline.png' },
  transcodeConfig: { resolution: { widthPx: 1920, heightPx: 1080 } },
} as unknown as ChannelOrmWithTranscodeConfig;

const programItem = (streamDuration: number): StreamLineupItem =>
  ({
    type: 'program',
    program: { uuid: 'prog-1', mediaSourceId: 'src-1' },
    infiniteLoop: false,
    programBeginMs: startMs,
    duration: streamDuration,
    streamDuration,
    startOffset: 0,
  }) as unknown as StreamLineupItem;

const offlineItem = (streamDuration: number): StreamLineupItem => ({
  type: 'offline',
  programBeginMs: startMs,
  duration: streamDuration,
  streamDuration,
  startOffset: 0,
});

/** Builds a writer whose four collaborators are fakes. */
function makeWriter({
  items,
  streamFails = false,
  noMediaSource = false,
}: {
  items: StreamLineupItem[];
  streamFails?: boolean;
  noMediaSource?: boolean;
}) {
  let call = 0;
  const programCalculator = {
    getCurrentLineupItem: vi.fn(() => {
      const item = items[Math.min(call++, items.length - 1)];
      return Promise.resolve(
        item === undefined
          ? Result.failure<never>('no lineup')
          : Result.success({ lineupItem: item }),
      );
    }),
  };

  const streamDetailsFetcher = {
    getStream: vi.fn(() =>
      Promise.resolve(
        streamFails
          ? Result.failure<never>('unreadable')
          : Result.success({
              streamSource: new FileStreamSource('/media/a.mkv'),
              streamDetails: {},
            }),
      ),
    ),
  };

  const mediaSourceDB = {
    getById: vi.fn(() =>
      Promise.resolve(noMediaSource ? null : { id: 'src-1' }),
    ),
  };

  const onDemandService = {
    getLiveTimestamp: vi.fn((_id: string, t: number) => Promise.resolve(t)),
  };

  const writer = new EtvNextPlayoutWriter(
    programCalculator as never,
    streamDetailsFetcher as never,
    mediaSourceDB as never,
    onDemandService as never,
  );

  // The logger is normally supplied by the DI decorator.
  Object.defineProperty(writer, 'logger', {
    value: { warn: vi.fn(), debug: vi.fn(), info: vi.fn(), error: vi.fn() },
  });

  return { writer, programCalculator, streamDetailsFetcher, onDemandService };
}

describe('materializeWindow', () => {
  test('walks the schedule forward, advancing by each item stream duration', async () => {
    const { writer } = makeWriter({
      items: [programItem(600_000), programItem(300_000), programItem(900_000)],
    });

    const window = await writer.materializeWindow({
      channel,
      startMs,
      windowMs: 1_800_000,
    });

    expect(window.items).toHaveLength(3);
    expect(window.finishMs).toBe(startMs + 1_800_000);
    expect(Date.parse(window.items[0].start)).toBe(startMs);
    expect(Date.parse(window.items[1].start)).toBe(startMs + 600_000);
    expect(Date.parse(window.items[2].start)).toBe(startMs + 900_000);
  });

  // Play history is stamped with the requested time, and the filler cooldown
  // reads history with an open upper bound, so a read-ahead that recorded
  // plays would put the channel on cooldown for programs it has not aired.
  test('never records a play for a moment that has not aired', async () => {
    const { writer, programCalculator } = makeWriter({
      items: [programItem(600_000), programItem(600_000)],
    });

    await writer.materializeWindow({ channel, startMs, windowMs: 1_200_000 });

    expect(programCalculator.getCurrentLineupItem).toHaveBeenCalled();
    for (const [request] of programCalculator.getCurrentLineupItem.mock.calls) {
      expect(request).toMatchObject({ recordPlayHistory: false });
    }
  });

  test('leaves no gap between one item finishing and the next starting', async () => {
    const { writer } = makeWriter({
      items: [programItem(600_000), programItem(600_000)],
    });

    const { items } = await writer.materializeWindow({
      channel,
      startMs,
      windowMs: 1_200_000,
    });

    expect(Date.parse(items[0].finish)).toBe(Date.parse(items[1].start));
  });

  test('stops at the window edge rather than overshooting it', async () => {
    const { writer } = makeWriter({ items: [programItem(600_000)] });

    const { items } = await writer.materializeWindow({
      channel,
      startMs,
      windowMs: 1_000_000,
    });

    expect(items).toHaveLength(2);
    expect(Date.parse(items[1].start)).toBeLessThan(startMs + 1_000_000);
  });

  test('translates wall clock through the on-demand cursor', async () => {
    const { writer, onDemandService } = makeWriter({
      items: [programItem(600_000)],
    });

    await writer.materializeWindow({ channel, startMs, windowMs: 600_000 });

    expect(onDemandService.getLiveTimestamp).toHaveBeenCalledWith(
      'chan-1',
      startMs,
    );
  });

  test('every materialized item strict-parses against the schema', async () => {
    const { writer } = makeWriter({
      items: [programItem(600_000), offlineItem(600_000)],
    });

    const { items } = await writer.materializeWindow({
      channel,
      startMs,
      windowMs: 1_200_000,
    });

    for (const item of items) {
      expect(PlayoutItemSchema.safeParse(item).error?.issues).toBeUndefined();
    }
  });

  test('gives offline slots the channel picture', async () => {
    const { writer } = makeWriter({ items: [offlineItem(600_000)] });

    const { items } = await writer.materializeWindow({
      channel,
      startMs,
      windowMs: 600_000,
    });

    expect(items[0].tracks?.video?.source).toEqual({
      source_type: 'local',
      path: '/media/offline.png',
    });
  });

  test('does not ask for a stream on an offline slot', async () => {
    const { writer, streamDetailsFetcher } = makeWriter({
      items: [offlineItem(600_000)],
    });

    await writer.materializeWindow({ channel, startMs, windowMs: 600_000 });

    expect(streamDetailsFetcher.getStream).not.toHaveBeenCalled();
  });
});

describe('degradation', () => {
  // One unplayable program must not cost the channel its window, and the slot
  // has to keep its place or everything after it drifts off wall clock.
  test('keeps the slot and plays an error screen when the stream fails', async () => {
    const { writer } = makeWriter({
      items: [programItem(600_000), programItem(600_000)],
      streamFails: true,
    });

    const { items, ignored } = await writer.materializeWindow({
      channel,
      startMs,
      windowMs: 1_200_000,
    });

    expect(items).toHaveLength(2);
    expect(items[0].tracks?.video?.source).toMatchObject({
      source_type: 'lavfi',
    });
    expect(Date.parse(items[1].start)).toBe(startMs + 600_000);
    expect(ignored.join(' ')).toContain('could not be resolved');
  });

  test('degrades the same way when the media source is gone', async () => {
    const { writer } = makeWriter({
      items: [programItem(600_000)],
      noMediaSource: true,
    });

    const { items } = await writer.materializeWindow({
      channel,
      startMs,
      windowMs: 600_000,
    });

    expect(items[0].tracks?.video?.source).toMatchObject({
      source_type: 'lavfi',
    });
  });
});

describe('loop guards', () => {
  // A zero-length item would spin forever, and upstream picks overlapping
  // items by rfind, so it could also mask the item before it.
  test('stops rather than spinning on an item that does not advance', async () => {
    const { writer } = makeWriter({ items: [programItem(0)] });

    const { items } = await writer.materializeWindow({
      channel,
      startMs,
      windowMs: 600_000,
    });

    expect(items).toEqual([]);
  });

  test('stops when the schedule cannot answer', async () => {
    const { writer } = makeWriter({ items: [] });

    const { items } = await writer.materializeWindow({
      channel,
      startMs,
      windowMs: 600_000,
    });

    expect(items).toEqual([]);
  });

  test('caps a window of very short items', async () => {
    const { writer } = makeWriter({ items: [programItem(1)] });

    const { items } = await writer.materializeWindow({
      channel,
      startMs,
      windowMs: 12 * 60 * 60 * 1000,
    });

    expect(items).toHaveLength(MaxItemsPerWindow);
  });
});
