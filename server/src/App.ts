import { inject, injectable } from 'inversify';
import { GlobalOptions } from './globals.ts';
import { Server } from './Server.ts';
import { EmptyTrashService } from './services/EmptyTrashService.ts';
import { StartupService } from './services/StartupService.ts';
import { KEYS } from './types/inject.ts';
import { InjectLogger } from './util/inject.ts';
import { Logger } from './util/logging/LoggerFactory.ts';
import { getTunarrVersion } from './util/version.ts';

/**
 * Delay before an interrupted empty-trash drain picks back up, so a restart
 * never competes with startup work for the event loop.
 */
const ResumeDelayMs = 30_000;

@injectable()
export class App {
  @InjectLogger() declare private readonly logger: Logger;

  constructor(
    @inject(KEYS.GlobalOptions) private globalOptions: GlobalOptions,
    @inject(StartupService) private startupService: StartupService,
    @inject(Server) private server: Server,
    @inject(EmptyTrashService) private emptyTrash: EmptyTrashService,
  ) {}

  async start() {
    this.logger.info('Starting Tunarr version %s', getTunarrVersion());
    this.logger.info(
      'Using Tunarr database directory: %s',
      this.globalOptions.databaseDirectory,
    );

    await this.startupService.runStartupServices();
    await this.server.runServer();

    // Fire-and-forget: the HTTP server is already accepting connections and the
    // search service is started, which the drain needs. Placing this after
    // runServer() also keeps worker threads out of it - they never call
    // App.start() - so two processes can never drain the same DB file.
    setTimeout(
      () => this.emptyTrash.resumeIfRequested(),
      ResumeDelayMs,
    ).unref();
  }
}
