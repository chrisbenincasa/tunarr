import { EntityManager } from '../dao/dataSource.ts';
import { ServerContext } from '../serverContext.ts';

declare module 'fastify' {
  interface FastifyRequest {
    serverCtx: ServerContext;
    entityManager: EntityManager;

    // Present when the request is identified as part of
    // an HLS session.
    streamChannel?: string;

    disableRequestLogging?: boolean;
  }
}
