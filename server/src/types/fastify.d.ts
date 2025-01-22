import { ServerContext } from '@/ServerContext.js';
import { ExtraLogLevels, LogLevels } from '@/util/logging/LoggerFactory.js';
import { LevelWithSilent } from 'pino';

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
