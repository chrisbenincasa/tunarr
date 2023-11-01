import { ServerContext } from '../server-context.ts';

export {};

declare global {
  namespace Express {
    export interface Request {
      ctx: ServerContext;
    }
  }
}
