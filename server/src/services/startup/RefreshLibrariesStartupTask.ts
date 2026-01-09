import { inject, injectable } from 'inversify';
import { RefreshMediaSourceLibraryTask } from '../../tasks/RefreshMediaSourceLibraryTask.ts';
import { KEYS } from '../../types/inject.ts';
import { Logger } from '../../util/logging/LoggerFactory.ts';
import { SimpleStartupTask } from './IStartupTask.ts';

@injectable()
export class RefreshLibrariesStartupTask extends SimpleStartupTask {
  id = RefreshLibrariesStartupTask.name;
  dependencies = [];

  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(RefreshMediaSourceLibraryTask)
    private task: RefreshMediaSourceLibraryTask,
  ) {
    super();
  }

  async getPromise(): Promise<void> {
    const result = await this.task.run(undefined);
    if (result.isFailure()) {
      this.logger.error(
        result.error,
        'Failed to run RefreshMediaSourceLibraryTask at startup.',
      );
    }
    return;
  }
}
