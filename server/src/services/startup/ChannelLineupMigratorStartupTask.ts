import { inject, injectable } from 'inversify';
import { ChannelLineupMigrator } from '../../migration/lineups/ChannelLineupMigrator.ts';
import { ClearM3uCacheStartupTask } from './ClearM3uCacheStartupTask.ts';
import { SimpleStartupTask } from './IStartupTask.ts';

@injectable()
export class ChannelLineupMigratorStartupTask extends SimpleStartupTask {
  id: string = ChannelLineupMigratorStartupTask.name;

  dependencies: string[] = [ClearM3uCacheStartupTask.name];

  constructor(
    @inject(ChannelLineupMigrator)
    private channelLineupMigrator: ChannelLineupMigrator,
  ) {
    super();
  }

  getPromise(): Promise<void> {
    return this.channelLineupMigrator.run();
  }
}
