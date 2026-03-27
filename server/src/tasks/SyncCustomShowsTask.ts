import type { Tag } from '@tunarr/types';
import { inject, injectable } from 'inversify';
import { CustomShowSyncService } from '../services/CustomShowSyncService.ts';
import { KEYS } from '../types/inject.ts';
import { Logger } from '../util/logging/LoggerFactory.ts';
import type { TaskMetadata } from './Task.ts';
import { SimpleTask } from './Task.ts';
import { simpleTaskDef } from './TaskRegistry.ts';

@injectable()
@simpleTaskDef({
  description: 'Syncs all custom shows linked to external playlists',
})
export class SyncCustomShowsTask extends SimpleTask {
  static KEY = Symbol.for(SyncCustomShowsTask.name);
  static ID = SyncCustomShowsTask.name;
  public ID = SyncCustomShowsTask.ID as Tag<
    typeof SyncCustomShowsTask.name,
    TaskMetadata
  >;

  constructor(
    @inject(KEYS.Logger) logger: Logger,
    @inject(CustomShowSyncService)
    private syncService: CustomShowSyncService,
  ) {
    super(logger);
  }

  protected async runInternal(): Promise<void> {
    await this.syncService.syncAll();
  }
}
