import { describe, expect, test, vi } from 'vitest';
import type { StreamLineupItem } from '../../db/derived_types/StreamLineup.ts';
import type { GetCurrentLineupItemRequest } from '../StreamProgramCalculator.ts';
import type { ChannelOrmWithTranscodeConfig } from '../../db/schema/derivedTypes.ts';
import { Result } from '../../types/result.ts';
import { FileStreamSource } from '../types.ts';
import { StreamTerminationRequestedError } from './EtvNextPlayoutItemMapper.ts';
import {
  EtvNextPlayoutWriter,
  MaxCallbacksPerWindow,
  MaxItemsPerWindow,
  MaxResolveSkips,
  MinResolvedItemMs,
  ResolverErrorItemMs,
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
    getCurrentLineupItem: vi.fn((_request: GetCurrentLineupItemRequest) => {
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
  const logger = {
    warn: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  };
  Object.defineProperty(writer, 'logger', { value: logger });

  return {
    writer,
    programCalculator,
    streamDetailsFetcher,
    onDemandService,
    logger,
  };
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

describe('resolveDynamicItem', () => {
  test('answers with the item playing at the position the worker asked about', async () => {
    const { writer } = makeWriter({ items: [programItem(600_000)] });

    const { item } = await writer.resolveDynamicItem({ channel, startMs });

    expect(Date.parse(item.start)).toBe(startMs);
    expect(Date.parse(item.finish)).toBe(startMs + 600_000);
    expect(item.source).toMatchObject({ source_type: 'local' });
  });

  // Unlike the read-ahead of a materialized window, this moment is about to
  // air, so the play has to be recorded.
  test('lets the calculator record the play', async () => {
    const { writer, programCalculator } = makeWriter({
      items: [programItem(600_000)],
    });

    await writer.resolveDynamicItem({ channel, startMs });

    const request = programCalculator.getCurrentLineupItem.mock.calls[0]?.[0];
    expect(request?.recordPlayHistory).toBeUndefined();
  });

  test('translates the position through the on-demand cursor', async () => {
    const { writer, programCalculator, onDemandService } = makeWriter({
      items: [programItem(600_000)],
    });
    onDemandService.getLiveTimestamp.mockResolvedValue(startMs - 3_600_000);

    const { item } = await writer.resolveDynamicItem({ channel, startMs });

    expect(onDemandService.getLiveTimestamp).toHaveBeenCalledWith(
      'chan-1',
      startMs,
    );
    expect(programCalculator.getCurrentLineupItem).toHaveBeenCalledWith(
      expect.objectContaining({ startTime: startMs - 3_600_000 }),
    );

    // The worker forces start to the position it is transcoding, so the answer
    // stays on wall clock even though the schedule was asked about its own.
    expect(Date.parse(item.start)).toBe(startMs);
  });

  test('strict-parses against the playout schema', async () => {
    const { writer } = makeWriter({ items: [programItem(600_000)] });

    const { item } = await writer.resolveDynamicItem({ channel, startMs });

    expect(PlayoutItemSchema.safeParse(item).error?.issues).toBeUndefined();
  });
});

describe('resolver failure', () => {
  // A failure the worker sees costs the viewer black video with nothing
  // logged, so an unanswerable moment comes back as a playable screen.
  test('answers a schedule failure with a short error screen', async () => {
    const { writer } = makeWriter({ items: [] });

    const { item } = await writer.resolveDynamicItem({ channel, startMs });

    expect(item.tracks?.video?.source).toMatchObject({ source_type: 'lavfi' });
    expect(Date.parse(item.finish) - Date.parse(item.start)).toBe(
      ResolverErrorItemMs,
    );
  });

  // A zero-length answer is re-resolved the instant it starts, which spins the
  // worker against the endpoint.
  test('answers an item of no length with an error screen', async () => {
    const { writer } = makeWriter({ items: [programItem(0)] });

    const { item } = await writer.resolveDynamicItem({ channel, startMs });

    expect(item.tracks?.video?.source).toMatchObject({ source_type: 'lavfi' });
  });

  test('keeps the error screen inside the placeholder window', async () => {
    const { writer } = makeWriter({ items: [] });

    const { item } = await writer.resolveDynamicItem({
      channel,
      startMs,
      untilMs: startMs + 5_000,
    });

    expect(Date.parse(item.finish) - Date.parse(item.start)).toBe(5_000);
  });

  test('still plays an error screen when the stream cannot be read', async () => {
    const { writer } = makeWriter({
      items: [programItem(600_000)],
      streamFails: true,
    });

    const { item, ignored } = await writer.resolveDynamicItem({
      channel,
      startMs,
    });

    expect(item.tracks?.video?.source).toMatchObject({ source_type: 'lavfi' });
    expect(ignored.join(' ')).toContain('could not be resolved');
  });
});

describe('the never-fail invariant', () => {
  // An instant Date.parse takes but the playout schema cannot render makes the
  // error screen itself throw. A throw here reaches Fastify as a 500, which
  // the worker plays as silent black, so the last fallback has to hold.
  test('answers an instant the error screen cannot render with a playable item', async () => {
    const { writer } = makeWriter({ items: [] });

    const { item } = await writer.resolveDynamicItem({
      channel,
      startMs: Date.parse('+012026-01-01T00:00:00.000Z'),
    });

    expect(PlayoutItemSchema.safeParse(item).error?.issues).toBeUndefined();
    expect(item.tracks?.video?.source).toMatchObject({ source_type: 'lavfi' });

    // The fallback carries its own clock rather than the instant it was given.
    expect(Date.parse(item.start)).toBeGreaterThan(Date.now() - 10_000);
  });

  test('answers the largest instant Date.parse takes with a playable item', async () => {
    const { writer } = makeWriter({ items: [programItem(600_000)] });

    const { item } = await writer.resolveDynamicItem({
      channel,
      startMs: Date.parse('+275760-09-13T00:00:00.000Z'),
    });

    expect(PlayoutItemSchema.safeParse(item).error?.issues).toBeUndefined();
  });

  // 'kill' asks for the stream to end, which only the caller can do, so it has
  // to survive the fallback rather than degrade to a screen.
  test('still asks for termination when the error screen is kill', async () => {
    const { writer } = makeWriter({ items: [] });
    const killChannel = {
      ...channel,
      transcodeConfig: { ...channel.transcodeConfig, errorScreen: 'kill' },
    } as ChannelOrmWithTranscodeConfig;

    await expect(
      writer.resolveDynamicItem({ channel: killChannel, startMs }),
    ).rejects.toThrow(StreamTerminationRequestedError);
  });
});

describe('items under the floor', () => {
  test('takes an item exactly at the floor', async () => {
    const { writer } = makeWriter({ items: [programItem(MinResolvedItemMs)] });

    const { item } = await writer.resolveDynamicItem({ channel, startMs });

    expect(item.source).toMatchObject({ source_type: 'local' });
  });

  // A viewer joining on the tail of a program lands here, and a transcode
  // stood up for the remainder costs more than the transition it covers.
  test('walks past a sub-second remainder and answers with the item after it', async () => {
    const { writer, programCalculator } = makeWriter({
      items: [programItem(400), programItem(600_000)],
    });

    const { item } = await writer.resolveDynamicItem({ channel, startMs });

    expect(item.source).toMatchObject({ source_type: 'local' });
    expect(Date.parse(item.finish) - Date.parse(item.start)).toBe(600_000);
    expect(programCalculator.getCurrentLineupItem.mock.calls.length).toBe(2);
  });

  // The remainder is folded into the transition, so the item after it takes
  // the position the worker asked about. Answering with the skipped-to instant
  // would have upstream seek backwards by the remainder.
  test('answers at the position the worker asked about, not the skipped-to one', async () => {
    const { writer, programCalculator } = makeWriter({
      items: [programItem(400), programItem(600_000)],
    });

    const { item } = await writer.resolveDynamicItem({ channel, startMs });

    expect(Date.parse(item.start)).toBe(startMs);
    expect(programCalculator.getCurrentLineupItem.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({ startTime: startMs + 400 }),
    );
  });

  test('walks the schedule on its own clock rather than re-reading the cursor', async () => {
    const { writer, onDemandService } = makeWriter({
      items: [programItem(400), programItem(600_000)],
    });

    await writer.resolveDynamicItem({ channel, startMs });

    expect(onDemandService.getLiveTimestamp).toHaveBeenCalledTimes(1);
  });

  test('walks past several short items in a row', async () => {
    const { writer, programCalculator } = makeWriter({
      items: [
        programItem(200),
        programItem(1),
        programItem(300),
        programItem(600_000),
      ],
    });

    const { item } = await writer.resolveDynamicItem({ channel, startMs });

    expect(item.source).toMatchObject({ source_type: 'local' });
    expect(programCalculator.getCurrentLineupItem.mock.calls.length).toBe(4);
  });

  // A schedule that answers every instant with a millisecond of filler cannot
  // be walked to anything playable, so it exhausts the skip count.
  test('gives up on a run of millisecond items and says so loudly', async () => {
    const { writer, programCalculator, logger } = makeWriter({
      items: [programItem(1)],
    });

    const { item } = await writer.resolveDynamicItem({ channel, startMs });

    expect(item.tracks?.video?.source).toMatchObject({ source_type: 'lavfi' });
    expect(
      Date.parse(item.finish) - Date.parse(item.start),
    ).toBeGreaterThanOrEqual(MinResolvedItemMs);
    expect(programCalculator.getCurrentLineupItem.mock.calls.length).toBe(
      MaxResolveSkips + 1,
    );
    expect(logger.error).toHaveBeenCalled();
  });

  // Items just under the floor would clear the skip count while walking the
  // channel seconds ahead of its schedule, so the time budget catches them.
  test('gives up once the walk would fold too much time into the transition', async () => {
    const { writer, programCalculator, logger } = makeWriter({
      items: [programItem(MinResolvedItemMs - 1)],
    });

    const { item } = await writer.resolveDynamicItem({ channel, startMs });

    expect(item.tracks?.video?.source).toMatchObject({ source_type: 'lavfi' });
    expect(logger.error).toHaveBeenCalled();

    // Two skips of 999 ms fit under the 2 s budget and a third does not, so
    // the walk stops well short of the skip count.
    expect(programCalculator.getCurrentLineupItem.mock.calls.length).toBe(3);
    expect(
      programCalculator.getCurrentLineupItem.mock.calls.length,
    ).toBeLessThan(MaxResolveSkips + 1);
  });
});

describe('callback rate', () => {
  test('backs a channel off once it blows its callback budget', async () => {
    const { writer, programCalculator } = makeWriter({
      items: [programItem(600_000)],
    });

    for (let i = 0; i < MaxCallbacksPerWindow + 3; i++) {
      const { item } = await writer.resolveDynamicItem({ channel, startMs });
      expect(PlayoutItemSchema.safeParse(item).error?.issues).toBeUndefined();
    }

    expect(programCalculator.getCurrentLineupItem.mock.calls.length).toBe(
      MaxCallbacksPerWindow,
    );
  });

  test("counts each channel's budget on its own", async () => {
    const { writer, programCalculator } = makeWriter({
      items: [programItem(600_000)],
    });
    const other = {
      ...channel,
      uuid: 'chan-2',
    } as ChannelOrmWithTranscodeConfig;

    for (let i = 0; i < MaxCallbacksPerWindow + 3; i++) {
      await writer.resolveDynamicItem({ channel, startMs });
    }
    await writer.resolveDynamicItem({ channel: other, startMs });

    expect(programCalculator.getCurrentLineupItem.mock.calls.length).toBe(
      MaxCallbacksPerWindow + 1,
    );
  });
});
