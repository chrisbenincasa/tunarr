import { faker } from '@faker-js/faker';
import type { TunarrEvent } from '@tunarr/types';
import type { EmptyTrashStatus } from '@tunarr/types/api';
import tmp from 'tmp-promise';
import { v4 } from 'uuid';
import { test as baseTest, describe, expect, vi } from 'vitest';
import { bootstrapTunarr } from '../bootstrap.ts';
import { DBAccess } from '../db/DBAccess.ts';
import type { IChannelDB } from '../db/interfaces/IChannelDB.ts';
import type { ISettingsDB } from '../db/interfaces/ISettingsDB.ts';
import { ProgramStateRepository } from '../db/program/ProgramStateRepository.ts';
import { Program } from '../db/schema/Program.ts';
import { ProgramGrouping } from '../db/schema/ProgramGrouping.ts';
import type { DrizzleDBAccess } from '../db/schema/index.ts';
import { setGlobalOptions } from '../globals.ts';
import { copyPreMigratedDb } from '../testing/testDbFactory.ts';
import { wait } from '../util/index.ts';
import {
  EmptyTrashProgramBatchSize,
  EmptyTrashService,
} from './EmptyTrashService.ts';
import type { EventService } from './EventService.ts';
import type { MeilisearchService } from './MeilisearchService.ts';

type Harness = {
  service: EmptyTrashService;
  stateRepo: ProgramStateRepository;
  drizzle: DrizzleDBAccess;
  channelDB: { removeProgramsFromAllLineups: ReturnType<typeof vi.fn> };
  search: { deleteByIds: ReturnType<typeof vi.fn> };
  settings: ISettingsDB;
  events: TunarrEvent[];
  pendingFlag: () => number | null;
};

type Fixture = {
  db: string;
  harness: Harness;
};

/**
 * Minimal stand-in for the parts of ISettingsDB the service touches, so the
 * flag lifecycle can be asserted without a settings file on disk.
 */
function fakeSettings() {
  let emptyTrashRequestedAt: number | null = null;
  return {
    get pendingOperations() {
      return { emptyTrashRequestedAt };
    },
    markEmptyTrashRequested(at: number) {
      emptyTrashRequestedAt = at;
      return Promise.resolve();
    },
    clearEmptyTrashRequested() {
      emptyTrashRequestedAt = null;
      return Promise.resolve();
    },
    read: () => emptyTrashRequestedAt,
  };
}

const test = baseTest.extend<Fixture>({
  db: async ({}, use) => {
    const dbResult = await tmp.dir({ unsafeCleanup: true });
    await copyPreMigratedDb(dbResult.path);
    setGlobalOptions({
      database: dbResult.path,
      log_level: 'debug',
      verbose: 0,
    });
    await bootstrapTunarr();
    await use(dbResult.path);
    await dbResult.cleanup();
  },
  harness: async ({ db: _ }, use) => {
    const dbAccess = DBAccess.instance;
    const drizzle = dbAccess.drizzle!;
    const stateRepo = new ProgramStateRepository(drizzle);

    // DBAccess is a process-wide singleton, so rows survive between tests in
    // this file. Start each one from an empty program/grouping table.
    await drizzle.delete(Program);
    await drizzle.delete(ProgramGrouping);

    const channelDB = {
      removeProgramsFromAllLineups: vi.fn().mockResolvedValue(0),
    };
    const search = { deleteByIds: vi.fn().mockResolvedValue(undefined) };
    const settings = fakeSettings();
    const events: TunarrEvent[] = [];

    const service = new EmptyTrashService(
      stateRepo,
      channelDB as unknown as IChannelDB,
      search as unknown as MeilisearchService,
      settings as unknown as ISettingsDB,
      { push: (ev: TunarrEvent) => events.push(ev) } as unknown as EventService,
    );

    await use({
      service,
      stateRepo,
      drizzle,
      channelDB,
      search,
      settings: settings as unknown as ISettingsDB,
      events,
      pendingFlag: settings.read,
    });
  },
});

async function insertMissingPrograms(
  drizzle: DrizzleDBAccess,
  count: number,
): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const uuid = v4();
    await drizzle.insert(Program).values({
      uuid,
      duration: 30000,
      type: 'movie',
      sourceType: 'plex',
      externalKey: faker.string.alphanumeric({ length: 16 }),
      externalSourceId: faker.string.alphanumeric({ length: 16 }),
      title: faker.word.words(3),
      year: 2020,
      state: 'missing',
    });
    ids.push(uuid);
  }
  return ids;
}

const TerminalStatuses = ['completed', 'cancelled', 'failed'];

/**
 * Waits for the drain's single terminal event. The service always emits
 * exactly one, which makes this deterministic where polling the status is not.
 */
async function settle(events: TunarrEvent[]) {
  for (let i = 0; i < 2000; i++) {
    const done = events.some(
      (ev) =>
        ev.type === 'empty_trash' &&
        TerminalStatuses.includes(ev.detail.status),
    );
    if (done) {
      return;
    }
    await wait(5);
  }
  throw new Error('Empty trash drain did not settle');
}

describe('EmptyTrashService', () => {
  test('deletes every trashed program and reports completion', async ({
    harness,
  }) => {
    await insertMissingPrograms(harness.drizzle, 5);

    await harness.service.request();
    await settle(harness.events);

    expect(await harness.stateRepo.countMissingPrograms()).toBe(0);

    const status = harness.service.getStatus();
    expect(status.state).toBe('idle');
    expect(status.deleted).toBe(5);
    expect(status.total).toBe(5);
    expect(status.error).toBeNull();

    expect(harness.pendingFlag()).toBeNull();
    expect(
      harness.events.map((ev) =>
        ev.type === 'empty_trash' ? ev.detail.status : ev.type,
      ),
    ).toEqual(['started', 'completed']);
  });

  test('runs lineup cleanup exactly once regardless of batch count', async ({
    harness,
  }) => {
    // More than one program batch, so a per-batch regression would show up as
    // multiple calls.
    await insertMissingPrograms(
      harness.drizzle,
      EmptyTrashProgramBatchSize + 10,
    );

    await harness.service.request();
    await settle(harness.events);

    expect(
      harness.channelDB.removeProgramsFromAllLineups,
    ).toHaveBeenCalledTimes(1);
    expect(harness.search.deleteByIds).toHaveBeenCalledTimes(2);
    expect(harness.search.deleteByIds.mock.calls[0][0]).toHaveLength(
      EmptyTrashProgramBatchSize,
    );
    expect(harness.search.deleteByIds.mock.calls[1][0]).toHaveLength(10);
  });

  test('search deletes carry exactly the ids of their own batch', async ({
    harness,
  }) => {
    const ids = await insertMissingPrograms(harness.drizzle, 4);

    await harness.service.request();
    await settle(harness.events);

    expect(harness.search.deleteByIds).toHaveBeenCalledTimes(1);
    expect([...harness.search.deleteByIds.mock.calls[0][0]].sort()).toEqual(
      [...ids].sort(),
    );
  });

  test('a concurrent request while running is a no-op', async ({ harness }) => {
    await insertMissingPrograms(harness.drizzle, 20);

    // Hold the drain open in phase 1 so the second request definitely lands
    // while the first is still running.
    let releaseLineupPass: () => void = () => {};
    const lineupGate = new Promise<void>((resolve) => {
      releaseLineupPass = resolve;
    });
    let secondStatus: EmptyTrashStatus | undefined;
    harness.channelDB.removeProgramsFromAllLineups.mockImplementation(
      async () => {
        secondStatus = await harness.service.request();
        await lineupGate;
        return 0;
      },
    );

    await harness.service.request();
    await wait(20);
    releaseLineupPass();
    await settle(harness.events);

    // The second request never restarted the drain, so only one 'started'
    // event is ever emitted.
    expect(
      harness.events.filter(
        (ev) => ev.type === 'empty_trash' && ev.detail.status === 'started',
      ),
    ).toHaveLength(1);
    expect(secondStatus?.state).toBe('running');
    expect(await harness.stateRepo.countMissingPrograms()).toBe(0);
  });

  test('cancel stops the drain early, keeps the rest, and clears the flag', async ({
    harness,
  }) => {
    await insertMissingPrograms(harness.drizzle, 30);

    // Stall phase 1 so cancel lands before anything is deleted.
    let releaseLineupPass: () => void = () => {};
    const lineupGate = new Promise<void>((resolve) => {
      releaseLineupPass = resolve;
    });
    harness.channelDB.removeProgramsFromAllLineups.mockImplementation(
      async () => {
        harness.service.cancel();
        await lineupGate;
        return 0;
      },
    );

    await harness.service.request();
    releaseLineupPass();
    await settle(harness.events);

    expect(await harness.stateRepo.countMissingPrograms()).toBe(30);
    expect(harness.service.getStatus().state).toBe('idle');
    expect(harness.pendingFlag()).toBeNull();
    expect(
      harness.events.some(
        (ev) => ev.type === 'empty_trash' && ev.detail.status === 'cancelled',
      ),
    ).toBe(true);
  });

  test('an error mid-drain preserves the flag and reports failure', async ({
    harness,
  }) => {
    await insertMissingPrograms(harness.drizzle, 5);

    harness.channelDB.removeProgramsFromAllLineups.mockRejectedValue(
      new Error('boom'),
    );

    await harness.service.request();
    await settle(harness.events);

    const status = harness.service.getStatus();
    expect(status.state).toBe('failed');
    expect(status.error).toContain('boom');
    // Left set deliberately: this is what makes the drain resume after a crash.
    expect(harness.pendingFlag()).not.toBeNull();
    expect(await harness.stateRepo.countMissingPrograms()).toBe(5);
  });

  test('resumeIfRequested no-ops when no request is pending', async ({
    harness,
  }) => {
    await insertMissingPrograms(harness.drizzle, 3);

    harness.service.resumeIfRequested();
    await wait(20);

    expect(await harness.stateRepo.countMissingPrograms()).toBe(3);
    expect(harness.events).toHaveLength(0);
  });

  test('resumeIfRequested drains when a request is pending', async ({
    harness,
  }) => {
    await insertMissingPrograms(harness.drizzle, 3);
    await harness.settings.markEmptyTrashRequested(Date.now());

    harness.service.resumeIfRequested();
    await settle(harness.events);

    expect(await harness.stateRepo.countMissingPrograms()).toBe(0);
    expect(harness.pendingFlag()).toBeNull();
  });

  test('deletes trashed groupings that nothing references any more', async ({
    harness,
  }) => {
    const showUuid = v4();
    const seasonUuid = v4();

    await harness.drizzle.insert(ProgramGrouping).values([
      {
        uuid: showUuid,
        title: 'Trashed Show',
        type: 'show',
        state: 'missing',
      },
      {
        uuid: seasonUuid,
        title: 'Trashed Season',
        type: 'season',
        showUuid,
        state: 'missing',
      },
    ]);

    await harness.service.request();
    await settle(harness.events);

    const remaining = await harness.drizzle.select().from(ProgramGrouping);
    expect(remaining.map((g) => g.uuid)).not.toContain(showUuid);
    expect(remaining.map((g) => g.uuid)).not.toContain(seasonUuid);
  });
});
