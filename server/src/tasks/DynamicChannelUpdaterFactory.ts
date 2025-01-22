import { DynamicContentConfigSource } from '@tunarr/types/api';
import { inject, injectable } from 'inversify';
import { Channel } from '../db/schema/Channel.ts';
import { ContentSourceUpdaterFactory } from '../services/dynamic_channels/DynamicChannelsModule.ts';
import { KEYS } from '../types/inject.ts';
import { Task } from './Task.ts';

@injectable()
export class DynamicChannelUpdaterFactory {
  @inject(KEYS.ContentSourceUpdateFactory)
  private contentSourceUpdaterFactory: ContentSourceUpdaterFactory;

  getTask(
    channel: Channel,
    contentSourceDef: DynamicContentConfigSource,
  ): Task<unknown> {
    // Have to capture 'this' before returning the anonymous class.
    const factory = this.contentSourceUpdaterFactory;
    // This won't always be anonymous
    return new (class extends Task<unknown> {
      public ID = contentSourceDef.updater._id;

      protected async runInternal() {
        return factory(channel, contentSourceDef).update();
      }
    })();
  }
}
