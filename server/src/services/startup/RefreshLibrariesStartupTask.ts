import { inject, injectable } from 'inversify';
import { RefreshMediaSourceLibraryTask } from '../../tasks/RefreshMediaSourceLibraryTask.ts';

import { InjectLogger } from '../../util/inject.ts';
import type { Logger } from '../../util/logging/LoggerFactory.ts';
import { SimpleStartupTask } from './IStartupTask.ts';

@injectable()
export class RefreshLibrariesStartupTask extends SimpleStartupTask {
  id = RefreshLibrariesStartupTask.name;
  dependencies = [];

  @InjectLogger() private declare readonly logger: Logger;

  constructor(
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
