import { isEmpty, uniq } from 'lodash-es';
import type { ServerType } from '../types/serverType.js';
import type { Logger } from '../util/logging/LoggerFactory.ts';

export abstract class Controller {
  constructor(protected logger: Logger) {}

  protected prefix?: string;

  protected tags?: string[];

  async attach(fastify: ServerType): Promise<void> {
    fastify.addHook('onRoute', (route) => {
      if (this.tags && !isEmpty(this.tags)) {
        route.schema ??= {};
        route.schema = {
          ...route.schema,
          tags: uniq([...(route.schema?.tags ?? []), ...this.tags]),
        };
      }
    });

    await fastify.register((f) => this.configure(f), {
      prefix: this.prefix,
    });
  }

  protected abstract configure(fastify: ServerType): Promise<void>;
}
