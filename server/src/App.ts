import { inject, injectable } from 'inversify';
import { GlobalOptions } from './globals.ts';
import { Server } from './Server.ts';
import { StartupService } from './services/StartupService.ts';
import { KEYS } from './types/inject.ts';
import { Logger } from './util/logging/LoggerFactory.ts';
import { getTunarrVersion } from './util/version.ts';

@injectable()
export class App {
  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(KEYS.GlobalOptions) private globalOptions: GlobalOptions,
    @inject(StartupService) private startupService: StartupService,
    @inject(Server) private server: Server,
  ) {}

  async start() {
    this.logger.info('Starting Tunarr version %s', getTunarrVersion());
    this.logger.info(
      'Using Tunarr database directory: %s',
      this.globalOptions.databaseDirectory,
    );

    await this.startupService.runStartupServices();
    await this.server.runServer();
  }
}
