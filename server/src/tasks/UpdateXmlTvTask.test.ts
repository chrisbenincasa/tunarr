import type { IChannelDB } from '@/db/interfaces/IChannelDB.ts';
import type { MediaSourceDB } from '@/db/mediaSourceDB.ts';
import type { MediaSourceApiFactory } from '@/external/MediaSourceApiFactory.ts';
import type { EventService } from '@/services/EventService.ts';
import { GlobalScheduler } from '@/services/Scheduler.ts';
import type { ScheduledTask } from '@/tasks/ScheduledTask.ts';
import type { TVGuideService } from '@/services/TvGuideService.ts';
import path from 'node:path';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import {
  inMemorySettingsDB,
  setTestGlobalOptions,
} from '../testing/getFakeSettingsDb.ts';
import { UpdateXmlTvTask } from './UpdateXmlTvTask.ts';

beforeAll(async () => {
  await setTestGlobalOptions();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function makeTask(settingsDB = inMemorySettingsDB()) {
  return new UpdateXmlTvTask(
    settingsDB,
    {
      buildAllChannels: vi.fn().mockResolvedValue(undefined),
    } as unknown as TVGuideService,
    { findByType: vi.fn().mockResolvedValue([]) } as unknown as MediaSourceDB,
    {} as MediaSourceApiFactory,
    { push: vi.fn() } as unknown as EventService,
    {
      getAllChannels: vi.fn().mockResolvedValue([]),
    } as unknown as IChannelDB,
  );
}

function mockSubtitleJob(running: boolean) {
  const runNow = vi.fn().mockResolvedValue(undefined);
  vi.spyOn(GlobalScheduler, 'getScheduledJob').mockReturnValue({
    running,
    runNow,
  } as unknown as ScheduledTask);
  return runNow;
}

describe('UpdateXmlTvTask', () => {
  test('keeps a configured output path whose file does not exist yet', async () => {
    const outputPath = path.join('/nonexistent', 'guides', 'xmltv.xml');
    const settingsDB = inMemorySettingsDB({
      settings: { xmltv: { outputPath } },
    });
    const updateSettings = vi.spyOn(settingsDB, 'updateSettings');
    mockSubtitleJob(false);

    await makeTask(settingsDB).run(undefined);

    expect(updateSettings).not.toHaveBeenCalled();
    expect(settingsDB.xmlTvSettings().outputPath).toBe(outputPath);
  });

  test('starts subtitle extraction after updating the guide', async () => {
    const runNow = mockSubtitleJob(false);

    await makeTask().run(undefined);

    expect(runNow).toHaveBeenCalledOnce();
  });

  test('does not start a second subtitle extraction run', async () => {
    const runNow = mockSubtitleJob(true);

    await makeTask().run(undefined);

    expect(runNow).not.toHaveBeenCalled();
  });
});
