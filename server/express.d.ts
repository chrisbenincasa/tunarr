import { ServerContext } from './server-context.js';

export {};

declare global {
  namespace Express {
    export interface Request {
      ctx: ServerContext;
    }
  }
}
