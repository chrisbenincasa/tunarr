import { inject, injectable } from 'inversify';
import { RefreshMediaSourceLibraryTask } from '../../tasks/RefreshMediaSourceLibraryTask.ts';
import { SimpleStartupTask } from './IStartupTask.ts';

@injectable()
export class RefreshLibrariesStartupTask extends SimpleStartupTask {
  id = RefreshLibrariesStartupTask.name;
  dependencies = [];

  constructor(
    @inject(RefreshMediaSourceLibraryTask)
    private task: RefreshMediaSourceLibraryTask,
  ) {
    super();
  }

  getPromise(): Promise<void> {
    return this.task.run();
  }
}
