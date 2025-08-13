import { inject, injectable } from 'inversify';
import { M3uService } from '../M3UService.ts';
import { SimpleStartupTask } from './IStartupTask.ts';

@injectable()
export class ClearM3uCacheStartupTask extends SimpleStartupTask {
  id = ClearM3uCacheStartupTask.name;

  dependencies: string[] = [];

  constructor(@inject(M3uService) private m3uService: M3uService) {
    super();
  }

  getPromise(): Promise<void> {
    return this.m3uService.clearCache();
  }
}
