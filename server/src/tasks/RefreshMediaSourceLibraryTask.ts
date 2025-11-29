import type { Tag } from '@tunarr/types';
import { inject, injectable } from 'inversify';

import { MediaSourceLibraryRefresher } from '../services/MediaSourceLibraryRefresher.ts';
import type { TaskId } from './Task.ts';
import { Task } from './Task.ts';

@injectable()
export class RefreshMediaSourceLibraryTask extends Task<[], void> {
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
