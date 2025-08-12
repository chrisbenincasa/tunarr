import { inject } from 'inversify';
import { SystemDevicesService } from '../SystemDevicesService.ts';
import { SimpleStartupTask } from './IStartupTask.ts';

export class SeedSystemDevicesStartupTask extends SimpleStartupTask {
  constructor(
    @inject(SystemDevicesService)
    private systemDevicesService: SystemDevicesService,
  ) {
    super();
  }

  id = SeedSystemDevicesStartupTask.name;

  dependencies: string[] = [];

  getPromise(): Promise<void> {
    return this.systemDevicesService.seed();
  }
}
