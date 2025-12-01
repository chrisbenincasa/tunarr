import { OneTimeMigrationManager } from '@/migration/onetime/OneTimeMigrationManager.js';
import { inject, injectable } from 'inversify';
import { ClearM3uCacheStartupTask } from './ClearM3uCacheStartupTask.js';
import { SimpleStartupTask } from './IStartupTask.js';

@injectable()
export class OneTimeMigrationStartupTask extends SimpleStartupTask {
  id = OneTimeMigrationStartupTask.name;

  // Run after database-related startup tasks but before most other tasks
  // Depends on ClearM3uCacheStartupTask to ensure clean slate
  dependencies = [ClearM3uCacheStartupTask.name];

  constructor(
    @inject(OneTimeMigrationManager)
    private migrationManager: OneTimeMigrationManager,
  ) {
    super();
  }

  async getPromise(): Promise<void> {
    await this.migrationManager.runMigrations();
  }
}
