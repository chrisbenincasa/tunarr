import type { Tag } from '@tunarr/types';
import { inject, injectable } from 'inversify';

import { MediaSourceLibraryRefresher } from '../services/MediaSourceLibraryRefresher.ts';
import type { TaskId } from './Task.ts';
import { SimpleTask } from './Task.ts';
import { simpleTaskDef } from './TaskRegistry.ts';

@injectable()
@simpleTaskDef({
  description:
    'Synchronizes the list of available libraries for external media sources.',
})
export class RefreshMediaSourceLibraryTask extends SimpleTask {
  static ID = RefreshMediaSourceLibraryTask.name;
  public ID: string | Tag<TaskId, unknown> = RefreshMediaSourceLibraryTask.ID;

  constructor(
    @inject(MediaSourceLibraryRefresher)
    private mediaSourceLibraryRefresher: MediaSourceLibraryRefresher,
  ) {
    super();
  }

  protected async runInternal(): Promise<void> {
    return await this.mediaSourceLibraryRefresher.refreshAll();
  }
}
