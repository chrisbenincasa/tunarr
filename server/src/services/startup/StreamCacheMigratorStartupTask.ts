import { inject, injectable } from 'inversify';
import { StreamCacheMigrator } from '../../migration/streamCache/StreamCacheMigrator.ts';
import { ClearM3uCacheStartupTask } from './ClearM3uCacheStartupTask.ts';
import { SimpleStartupTask } from './IStartupTask.ts';

@injectable()
export class StreamCacheMigratorStartupTask extends SimpleStartupTask {
  id: string = StreamCacheMigratorStartupTask.name;

  dependencies: string[] = [ClearM3uCacheStartupTask.name];

  constructor(
    @inject(StreamCacheMigrator)
    private streamCacheMigrator: StreamCacheMigrator,
  ) {
    super();
  }

  getPromise(): Promise<void> {
    return this.streamCacheMigrator.run();
  }
}
