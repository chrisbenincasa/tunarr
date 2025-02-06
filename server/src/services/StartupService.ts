import { inject, injectable } from 'inversify';
import { KEYS } from '../types/inject.ts';
import type { Logger } from '../util/logging/LoggerFactory.ts';
import { SystemDevicesService } from './SystemDevicesService.ts';

@injectable()
export class StartupService {
  #hasRun = false;

  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(SystemDevicesService)
    private systemDevicesService: SystemDevicesService,
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
    }
  }
}
