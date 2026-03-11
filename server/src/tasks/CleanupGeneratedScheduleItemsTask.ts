import { InfiniteScheduleDB } from '@/db/InfiniteScheduleDB.js';
import { KEYS } from '@/types/inject.js';
import { type Logger } from '@/util/logging/LoggerFactory.js';
import { inject, injectable } from 'inversify';
import { SimpleTask, TaskId } from './Task.js';
import { simpleTaskDef } from './TaskRegistry.ts';

@injectable()
@simpleTaskDef({
  description: 'Removes expired generated schedule items from the database',
})
export class CleanupGeneratedScheduleItemsTask extends SimpleTask {
  static KEY = Symbol.for(CleanupGeneratedScheduleItemsTask.name);
  public static ID: TaskId = 'cleanup-generated-schedule-items';
  public ID = CleanupGeneratedScheduleItemsTask.ID;

  constructor(
    @inject(KEYS.Logger) logger: Logger,
    @inject(KEYS.InfiniteScheduleDB)
    private infiniteScheduleDB: InfiniteScheduleDB,
  ) {
    super(logger);
  }

  protected async runInternal(): Promise<void> {
    const deleted = await this.infiniteScheduleDB.deleteAllGeneratedItemsBefore(
      Date.now(),
    );
    if (deleted > 0) {
      this.logger.debug('Cleaned up %d expired generated schedule items', deleted);
    }
  }

  get taskName() {
    return CleanupGeneratedScheduleItemsTask.name;
  }
}
