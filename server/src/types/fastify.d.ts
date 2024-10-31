import { LevelWithSilent } from 'pino';
import { ServerContext } from '../serverContext.ts';
import { ExtraLogLevels, LogLevels } from '../util/logging/LoggerFactory.js';

declare module 'fastify' {
  interface FastifyRequest {
    serverCtx: ServerContext;

    // Present when the request is identified as part of
    // an HLS session.
    streamChannel?: string;

    disableRequestLogging?: boolean;
    logRequestAtLevel?: LevelWithSilent | ExtraLogLevels;
  }

  interface FastifyContextConfig {
    logAtLevel?: LogLevels;
    disableRequestLogging?: boolean;
  }
}
