import { inject, injectable } from 'inversify';
import { M3uService } from '../services/M3UService.ts';
import { InjectLogger } from '../util/inject.ts';
import { Logger } from '../util/logging/LoggerFactory.ts';
import { SimpleTask } from './Task.ts';
import { simpleTaskDef } from './TaskRegistry.ts';

@injectable()
@simpleTaskDef({
  description: 'Clears the m3u cache and regenerates it',
})
export class ClearM3uCacheTask extends SimpleTask {
  ID = ClearM3uCacheTask.name;

  @InjectLogger() protected declare readonly logger: Logger;

  constructor(
    @inject(M3uService) private m3uService: M3uService,
  ) {
    super();
  }

  protected async runInternal(): Promise<void> {
    return await this.m3uService.regenerateCache();
  }
}
