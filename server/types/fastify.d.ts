import { EntityManager } from '../dao/dataSource.ts';
import { ServerContext } from '../serverContext.ts';

declare module 'fastify' {
  interface FastifyRequest {
    serverCtx: ServerContext;
    entityManager: EntityManager;
  }
}
