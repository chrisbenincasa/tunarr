import type { ServerContext } from '@/ServerContext.js';
import type {
  ExtraLogLevels,
  LogLevels,
} from '@/util/logging/LoggerFactory.js';
import type { LevelWithSilent } from 'pino';

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
