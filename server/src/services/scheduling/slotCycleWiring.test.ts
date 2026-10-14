import { Container } from 'inversify';
import { describe, expect, test, vi } from 'vitest';
import { BuildSlotCycleCommand } from '../../commands/BuildSlotCycleCommand.ts';
import type { IChannelDB } from '../../db/interfaces/IChannelDB.ts';
import type { ISettingsDB } from '../../db/interfaces/ISettingsDB.ts';
import type { IWorkerPool } from '../../interfaces/IWorkerPool.ts';
import { SlotCycleBoundaryTask } from '../../tasks/SlotCycleBoundaryTask.ts';
import { KEYS } from '../../types/inject.ts';
import { bindAutoFactory } from '../../util/inject.ts';
import { ChannelLineupLock } from '../ChannelLineupLock.ts';
import { TVGuideService } from '../TvGuideService.ts';
import { SlotCycleBoundaryService } from './SlotCycleBoundaryService.ts';

// The real guide service pulls in most of the server, and this only checks
// that the container can build the boundary service.
vi.mock('../TvGuideService.ts', () => ({ TVGuideService: class {} }));
vi.mock('@/services/TvGuideService.js', () => ({ TVGuideService: class {} }));

// Mirrors the production container: autobind on, no default scope.
function containerLikeProduction() {
  const container = new Container({ autobind: true });
  container.bind(ChannelLineupLock).toSelf().inSingletonScope();
  container.bind(KEYS.ChannelLineupLock).toService(ChannelLineupLock);
  container.bind<IChannelDB>(KEYS.ChannelDB).toConstantValue({} as IChannelDB);
  container
    .bind<ISettingsDB>(KEYS.SettingsDB)
    .toConstantValue({} as ISettingsDB);
  container
    .bind<() => IWorkerPool>(KEYS.WorkerPoolFactory)
    .toConstantValue(() => ({}) as IWorkerPool);
  container.bind(TVGuideService).toConstantValue({} as TVGuideService);
  return container;
}

describe('slot cycle wiring', () => {
  // The logger is the one constructor parameter the container does not
  // supply, so resolution would throw if it were treated as a dependency.
  test('the container builds the boundary service', () => {
    const container = containerLikeProduction();

    const service = container.get(SlotCycleBoundaryService);

    expect(service).toBeInstanceOf(SlotCycleBoundaryService);
  });

  test('the container builds the cycle builder', () => {
    const container = containerLikeProduction();

    expect(container.get(BuildSlotCycleCommand)).toBeInstanceOf(
      BuildSlotCycleCommand,
    );
  });

  // ScheduleJobsStartupTask resolves the task through this factory, so a
  // missing dependency would fail the whole startup sequence.
  test('the task factory builds the task', () => {
    const container = containerLikeProduction();
    container.bind(SlotCycleBoundaryTask).toSelf();
    bindAutoFactory(
      container.bind.bind(container),
      SlotCycleBoundaryTask.KEY,
      SlotCycleBoundaryTask,
    );

    const factory = container.get<() => SlotCycleBoundaryTask>(
      SlotCycleBoundaryTask.KEY,
    );

    expect(factory()).toBeInstanceOf(SlotCycleBoundaryTask);
  });
});
