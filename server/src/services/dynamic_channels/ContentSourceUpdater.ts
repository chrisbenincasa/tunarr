import type { ChannelOrm } from '@/db/schema/Channel.js';
import type { DynamicContentConfigSource } from '@tunarr/types/api';
import { Mutex, withTimeout } from 'async-mutex';

const locks: Record<DynamicContentConfigSource['type'], Mutex> = {
  plex: new Mutex(),
};

export abstract class ContentSourceUpdater<
  T extends DynamicContentConfigSource,
> {
  protected initialized: boolean = false;
  protected channel: ChannelOrm;
  protected config: T;

  constructor(channel: ChannelOrm, config: T) {
    this.channel = channel;
    this.config = config;
  }

  public update(): Promise<void> {
    return this.runInternal();
  }

  private async runInternal() {
    return withTimeout(locks[this.config.type], 60 * 1000).runExclusive(() =>
      this.run(),
    );
  }

  /**
   * Implementations should use this function to prepare any
   * depedencies or internal resources before the updater runs.
   * This is run in a DB request context and an entity manager is
   * provided.
   */
  protected abstract prepare(): Promise<void>;

  /**
   * Update the content...
   * TODO figure out if we can generalize enough to just return programs here
   */
  protected abstract run(): Promise<void>;
}
