import { ServerContext } from './serverContext.ts';

export {};

declare global {
  namespace Express {
    export interface Request {
      ctx: ServerContext;
    }
  }
}
