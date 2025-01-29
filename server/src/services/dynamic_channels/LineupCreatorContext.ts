import type { ProgramDao } from '@/db/schema/Program.js';
import { isUndefined } from 'lodash-es';
import { AsyncLocalStorage } from 'node:async_hooks';

export interface LineupBuilderContext {
  channelId: string;
  programById: Record<string, ProgramDao>;
}

export class LineupCreatorContext {
  static storage = new AsyncLocalStorage<LineupBuilderContext>();

  static currentServerContext(): LineupBuilderContext | undefined {
    return this.storage.getStore();
  }

  static create<T>(
    context: LineupBuilderContext,
    next: (...args: unknown[]) => T,
  ) {
    this.storage.run(context, next);
  }

  static getContext() {
    const ctx = this.currentServerContext();
    if (isUndefined(ctx)) throw new Error('No current server context!!');
    return ctx;
  }

  static withContext<T>(f: (ctx: LineupBuilderContext) => T) {
    return f(this.getContext());
  }

  static withContextAsync = async <T>(
    f: (ctx: LineupBuilderContext) => Promise<T>,
  ) => {
    return await f(this.getContext());
  };
}
