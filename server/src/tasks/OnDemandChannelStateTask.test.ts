import type { IChannelDB } from '@/db/interfaces/IChannelDB.ts';
import type { OnDemandChannelService } from '@/services/OnDemandChannelService.js';
import type { SessionManager } from '@/stream/SessionManager.js';
import { describe, expect, test, vi } from 'vitest';

// OnDemandChannelStateTask imports OnDemandChannelService (and transitively
// SessionManager) through Inversify bindings that only resolve inside a booted
// container. Mock the DI classes before importing the task, mirroring
// SessionManager.test.ts.
vi.mock('@/services/OnDemandChannelService.js', () => ({
  OnDemandChannelService: class {},
}));
vi.mock('@/services/EventService.js', () => ({
  EventService: class {},
}));

import { OnDemandChannelStateTask } from './OnDemandChannelStateTask.ts';

function makeSut(sessionConnections: number[]) {
  const channelDB = {
    loadAllLineupConfigs: vi.fn().mockResolvedValue({
      cfg1: { channel: { uuid: 'ch1' } },
    }),
  } as unknown as IChannelDB;

  const onDemandService = {
    pauseChannel: vi.fn().mockResolvedValue(undefined),
  } as unknown as OnDemandChannelService;

  const sessionManager = {
    getAllSessionsForChannel: vi.fn().mockReturnValue(
      sessionConnections.map((count) => ({
        numConnections: () => count,
      })),
    ),
  } as unknown as SessionManager;

  const task = new OnDemandChannelStateTask(
    channelDB,
    onDemandService,
    sessionManager,
  );

  return { task, onDemandService, sessionManager };
}

describe('OnDemandChannelStateTask', () => {
  test('does not pause a channel with zero sessions', async () => {
    const { task, onDemandService } = makeSut([]);

    await task.run(undefined);

    // lodash `every([])` returns true, so without the length guard this
    // would call pauseChannel on every tick for a channel with no sessions.
    expect(onDemandService.pauseChannel).not.toHaveBeenCalled();
  });

  test('pauses a channel whose sessions are all idle', async () => {
    const { task, onDemandService } = makeSut([0, 0]);

    await task.run(undefined);

    expect(onDemandService.pauseChannel).toHaveBeenCalledTimes(1);
    expect(onDemandService.pauseChannel).toHaveBeenCalledWith(
      'ch1',
      expect.any(Number),
    );
  });

  test('does not pause a channel with an active session', async () => {
    const { task, onDemandService } = makeSut([1, 0]);

    await task.run(undefined);

    expect(onDemandService.pauseChannel).not.toHaveBeenCalled();
  });
});
