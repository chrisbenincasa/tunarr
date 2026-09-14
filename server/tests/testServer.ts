import dayjs from 'dayjs';
import tmp from 'tmp-promise';
import { bootstrapTunarr } from '../src/bootstrap.ts';
import { container } from '../src/container.ts';
import { setServerOptions } from '../src/globals.js';
import { Server } from '../src/Server.js';
import { GlobalScheduler } from '../src/services/Scheduler.ts';
import { ScheduledTask } from '../src/tasks/ScheduledTask.ts';
import { SubtitleExtractorTask } from '../src/tasks/SubtitleExtractorTask.ts';
import { UpdateXmlTvTask } from '../src/tasks/UpdateXmlTvTask.ts';
import { copyPreMigratedDb } from '../src/testing/testDbFactory.ts';
import { autoFactoryKey, KEYS } from '../src/types/inject.ts';

// Make this a fixture
export let dbResult: tmp.DirectoryResult;

export type InitTestAppOptions = {
  /**
   * Register UpdateXmlTvTask with the GlobalScheduler.
   *
   * Tests boot through `Server.runServer()` rather than `App.start()`, so
   * `StartupService.runStartupServices()` never runs and no scheduled jobs are
   * registered. Code that fires the guide refresh — notably the lineup save in
   * channelsApi — looks the job up by ID and swallows the resulting failure, so
   * without this the entire guide rebuild silently does not happen and a test
   * measuring it would pass while measuring nothing.
   *
   * Off by default so existing tests keep their current behavior.
   */
  registerGuideTask?: boolean;
};

export async function initTestApp(
  port: number,
  { registerGuideTask = false }: InitTestAppOptions = {},
) {
  dbResult = await tmp.dir({ unsafeCleanup: true });
  await copyPreMigratedDb(dbResult.path);
  setServerOptions({
    database: dbResult.path,
    force_migration: false,
    log_level: 'debug',
    verbose: 0,
    port,
    printRoutes: false,
    trustProxy: false,
  });
  await bootstrapTunarr();

  if (registerGuideTask) {
    scheduleGuideTaskForTest();
  }

  return await container.get(Server).runServer();
}

/**
 * Registers the XMLTV task on a schedule far enough out that it never fires on
 * its own. Every run in a test is therefore an explicit `runNow`, triggered by
 * the code under test.
 */
function scheduleGuideTaskForTest() {
  const neverOnItsOwn = () => dayjs().add(10, 'year').toDate();

  GlobalScheduler.scheduleTask(
    UpdateXmlTvTask.ID,
    new ScheduledTask(
      UpdateXmlTvTask,
      neverOnItsOwn(),
      container.get<() => UpdateXmlTvTask>(KEYS.UpdateXmlTvTaskFactory),
      {},
    ),
  );

  // UpdateXmlTvTask fires this one by ID once the guide is built. Looking up an
  // unregistered job throws synchronously, which its `.catch()` cannot see, and
  // the outer handler would then abandon the rest of the task. Register it so
  // the measured path matches production.
  GlobalScheduler.scheduleTask(
    SubtitleExtractorTask.ID,
    new ScheduledTask(
      SubtitleExtractorTask,
      neverOnItsOwn(),
      container.get<() => SubtitleExtractorTask>(
        autoFactoryKey(SubtitleExtractorTask),
      ),
      {},
    ),
  );
}
