import { ServerContext } from '../serverContext.ts';

declare module 'fastify' {
  interface FastifyRequest {
    serverCtx: ServerContext;
  }
}
