import { DynamicContentConfigSource } from '@tunarr/types/api';
import { inject, injectable } from 'inversify';
import { ChannelOrm } from '../db/schema/Channel.ts';
import type { ContentSourceUpdaterFactory } from '../services/dynamic_channels/DynamicChannelsModule.ts';
import { KEYS } from '../types/inject.ts';
import { Task } from './Task.ts';

@injectable()
export class DynamicChannelUpdaterFactory {
  @inject(KEYS.ContentSourceUpdateFactory)
  private contentSourceUpdaterFactory: ContentSourceUpdaterFactory;

  getTask(
    channel: ChannelOrm,
    contentSourceDef: DynamicContentConfigSource,
  ): Task {
    // Have to capture 'this' before returning the anonymous class.
    const factory = this.contentSourceUpdaterFactory;
    // This won't always be anonymous
    return new (class extends Task {
      public ID = contentSourceDef.updater._id;

      protected async runInternal() {
        return factory(channel, contentSourceDef).update();
      }
    })();
  }
}
