import { inject, injectable } from 'inversify';
import { MediaSourceDB } from '../db/mediaSourceDB.ts';
import type { ProgramStateRepository } from '../db/program/ProgramStateRepository.ts';
import { MeilisearchService } from '../services/MeilisearchService.ts';
import { KEYS } from '../types/inject.ts';
import { InjectLogger } from '../util/inject.ts';
import type { Logger } from '../util/logging/LoggerFactory.ts';
import { findDanglingSearchDocumentIds } from '../util/search.ts';
import { SimpleTask } from './Task.ts';
import { simpleTaskDef } from './TaskRegistry.ts';

const DocumentPageSize = 1_000;

@injectable()
@simpleTaskDef({
  name: RemoveDanglingProgramsFromSearchTask.name,
  description:
    'Removes programs from the search index whose media source or database row no longer exists',
})
export class RemoveDanglingProgramsFromSearchTask extends SimpleTask {
  static ID = RemoveDanglingProgramsFromSearchTask.name;
  public ID = RemoveDanglingProgramsFromSearchTask.ID;

  @InjectLogger() declare protected readonly logger: Logger;

  constructor(
    @inject(MediaSourceDB) private mediaSourceDB: MediaSourceDB,
    @inject(MeilisearchService) private searchService: MeilisearchService,
    @inject(KEYS.ProgramStateRepository)
    private programStateRepo: ProgramStateRepository,
  ) {
    super();
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

    await this.removeDocumentsWithoutRows();
  }

  // A media source can outlive programs that were deleted from the DB without
  // touching the index, e.g. a local folder removed before it was trashed.
  // Deletes wait until the scan ends so they don't shift its offsets.
  private async removeDocumentsWithoutRows(): Promise<void> {
    const danglingIds: string[] = [];
    for await (const page of this.searchService.allProgramDocumentRefs(
      DocumentPageSize,
    )) {
      const pageIds = page.map(({ id }) => id);
      const [programIds, groupingIds] = await Promise.all([
        this.programStateRepo.findExistingProgramIds(pageIds),
        this.programStateRepo.findExistingGroupingIds(pageIds),
      ]);
      danglingIds.push(
        ...findDanglingSearchDocumentIds(page, programIds, groupingIds),
      );
    }

    if (danglingIds.length === 0) {
      return;
    }

    this.logger.info(
      'Removing %d search document(s) with no matching DB row',
      danglingIds.length,
    );
    const result = await this.searchService.deleteByIds(danglingIds);
    if (result) {
      this.searchService.monitorTask(result.taskUid).catch(() => {});
    }
  }
}
