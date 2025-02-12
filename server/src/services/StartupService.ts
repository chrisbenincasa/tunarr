import { inject, injectable } from 'inversify';
import { isMainThread } from 'node:worker_threads';
import { IWorkerPool } from '../interfaces/IWorkerPool.ts';
import { KEYS } from '../types/inject.ts';
import type { Logger } from '../util/logging/LoggerFactory.ts';
import { MeilisearchService } from './SearchService.ts';
import { SystemDevicesService } from './SystemDevicesService.ts';

@injectable()
export class StartupService {
  #hasRun = false;

  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(SystemDevicesService)
    private systemDevicesService: SystemDevicesService,
    @inject(KEYS.WorkerPool)
    private workerPool: IWorkerPool,
    @inject(MeilisearchService)
    public readonly searchService: MeilisearchService,
  ) {}

  async runStartupServices() {
    if (!this.#hasRun) {
      try {
        await Promise.all([this.systemDevicesService.seed()]);
      } catch (e) {
        this.logger.fatal(
          e,
          'Error when running startup services! The system might not function normally.',
        );
      }

      await this.searchService.start();
      await this.searchService.sync();

      if (isMainThread) {
        this.workerPool.start();
      }
    }
  }

  waitForCompletion() {
    return Promise.all([this.workerPool.allReady()]);
  }
}
