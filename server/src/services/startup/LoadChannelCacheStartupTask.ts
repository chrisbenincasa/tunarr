import { inject, injectable } from 'inversify';
import { PersistentChannelCache } from '../../stream/ChannelCache.ts';
import { SimpleStartupTask } from './IStartupTask.ts';

@injectable()
export class LoadChannelCacheStartupTask extends SimpleStartupTask {
  id = LoadChannelCacheStartupTask.name;
  dependencies: string[] = [];

  constructor(
    @inject(PersistentChannelCache)
    private persistentChannelCache: PersistentChannelCache,
  ) {
    super();
  }

  getPromise(): Promise<void> {
    return this.persistentChannelCache.init();
  }
}
