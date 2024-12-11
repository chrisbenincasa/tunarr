import { Channel } from '@/db/schema/Channel.ts';
import { MutexMap } from '@/util/mutexMap.ts';
import { DynamicContentConfigSource } from '@tunarr/types/api';
import { Mutex, withTimeout } from 'async-mutex';

const locks: Record<DynamicContentConfigSource['type'], Mutex> = {
  plex: new Mutex(),
};

export type ContentSourceUpdaterContext<T extends DynamicContentConfigSource> =
  {
    channel: Channel;
    config: T;
  };

export abstract class ContentSourceUpdater<
  T extends DynamicContentConfigSource,
> {
  protected static locks = new MutexMap();

  protected initialized: boolean = false;

  public update(channel: Channel, config: T): Promise<void> {
    return this.runInternal({ channel, config });
  }

  private async runInternal(context: ContentSourceUpdaterContext<T>) {
    const { config } = context;
    return withTimeout(locks[config.type], 60 * 1000).runExclusive(async () => {
      await this.prepare(context);
      await this.run(context);
    });
  }

  /**
   * Implementations should use this function to prepare any
   * depedencies or internal resources before the updater runs.
   * This is run in a DB request context and an entity manager is
   * provided.
   */
  protected abstract prepare(
    context: ContentSourceUpdaterContext<T>,
  ): Promise<void>;

  /**
   * Update the content...
   * TODO figure out if we can generalize enough to just return programs here
   */
  protected abstract run(
    context: ContentSourceUpdaterContext<T>,
  ): Promise<void>;
}
