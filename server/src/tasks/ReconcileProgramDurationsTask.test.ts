import type { Kysely } from 'kysely';
import { describe, expect, test, vi } from 'vitest';
import type { Lineup } from '@/db/derived_types/Lineup.ts';
import type { IChannelDB } from '@/db/interfaces/IChannelDB.ts';
import type { DB } from '@/db/schema/db.ts';
import { ReconcileProgramDurationsTask } from './ReconcileProgramDurationsTask.ts';

describe('ReconcileProgramDurationsTask', () => {
  test('recomputes startTimeOffsets when it corrects program durations', async () => {
    // Two content items persisted with stale durations and the matching stale
    // startTimeOffsets (based on those old durations).
    const staleLineup = {
      id: 'uid1',
      channel_uuid: 'ch1',
      items: [
        { type: 'content', id: 'p1', durationMs: 1000 },
        { type: 'content', id: 'p2', durationMs: 500 },
      ],
      startTimeOffsets: [0, 1000, 1500],
      version: 0,
    } as unknown as Lineup;

    const savedLineups: Record<string, unknown>[] = [];
    const channelDB = {
      getAllChannels: vi.fn().mockResolvedValue([{ uuid: 'ch1' }]),
      loadLineup: vi.fn().mockResolvedValue(staleLineup),
      saveLineup: vi.fn(async (_channelId: string, newLineup: unknown) => {
        savedLineups.push(newLineup as Record<string, unknown>);
        return {};
      }),
    } as unknown as IChannelDB;

    // Programs table is the source of truth for durations.
    const db = {
      selectFrom: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue([
              { uuid: 'p1', duration: 60000 },
              { uuid: 'p2', duration: 30000 },
            ]),
          }),
        }),
      }),
    } as unknown as Kysely<DB>;

    const task = new ReconcileProgramDurationsTask(channelDB, db);
    await task.run(undefined);

    expect(savedLineups).toHaveLength(1);
    const saved = savedLineups[0] as {
      items: { type: string; id: string; durationMs: number }[];
      startTimeOffsets: number[];
    };
    expect(saved.items).toEqual([
      { type: 'content', id: 'p1', durationMs: 60000 },
      { type: 'content', id: 'p2', durationMs: 30000 },
    ]);
    // The persisted startTimeOffsets must reflect the corrected durations,
    // not be carried over stale from the pre-correction lineup.
    expect(saved.startTimeOffsets).toEqual([0, 60000, 90000]);
  });
});
