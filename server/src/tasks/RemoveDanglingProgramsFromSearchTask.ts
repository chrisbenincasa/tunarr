import { inject, injectable } from 'inversify';
import { MediaSourceDB } from '../db/mediaSourceDB.ts';
import { MeilisearchService } from '../services/MeilisearchService.ts';
import { KEYS } from '../types/inject.ts';
import { Logger } from '../util/logging/LoggerFactory.ts';
import { ReconcileProgramDurationsTask } from './ReconcileProgramDurationsTask.ts';
import { SimpleTask } from './Task.ts';
import { simpleTaskDef } from './TaskRegistry.ts';

@injectable()
@simpleTaskDef({
  name: RemoveDanglingProgramsFromSearchTask.name,
  description:
    'Removes programs from the search index that have media sources which do not exist in the database',
})
export class RemoveDanglingProgramsFromSearchTask extends SimpleTask {
  static ID = ReconcileProgramDurationsTask.name;
  public ID = ReconcileProgramDurationsTask.name;

  constructor(
    @inject(KEYS.Logger) logger: Logger,
    @inject(MediaSourceDB) private mediaSourceDB: MediaSourceDB,
    @inject(MeilisearchService) private searchService: MeilisearchService,
  ) {
    super(logger);
  }

  protected async runInternal(): Promise<void> {
    const allMediaSources = await this.mediaSourceDB.getAll();
    const ids = allMediaSources.map((ms) => ms.uuid);
    if (ids.length === 0) {
      // if we have nothing... we gotta just delete everything
      const result = await this.searchService.deleteAll();
      if (result) {
        this.logger.info('Scheduled search index deletion task: %O', result);
        this.searchService.monitorTask(result.taskUid).catch(() => {});
      }
      return;
    }

    const result = await this.searchService.deleteByMediaSourceIds(ids);
    if (result) {
      this.logger.info('Scheduled search index deletion task: %O', result);
      this.searchService.monitorTask(result.taskUid).catch(() => {
        // Swallow
      });
    }
  }
}
