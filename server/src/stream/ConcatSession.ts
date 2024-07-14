import { isUndefined } from 'lodash-es';
import { Maybe } from '../types/util';
import { ConcatStream, VideoStreamResult } from './ConcatStream';
import { SessionOptions, StreamSession } from './StreamSession';
import { Channel } from '../dao/entities/Channel';

export class ConcatSession extends StreamSession {
  private streamStopFunc: Maybe<() => void>;

  protected constructor(channel: Channel, options: SessionOptions) {
    super(channel, options);
  }

  static create(channel: Channel, options: SessionOptions) {
    return new ConcatSession(channel, options);
  }

  protected async initializeStream(): Promise<VideoStreamResult> {
    const result = await new ConcatStream().startStream(
      this.channel.uuid,
      /* audioOnly */ false,
    );

    if (result.type === 'success') {
      this.streamStopFunc = result.stop.bind(result) as () => void;
    }

    return result;
  }

  protected stopStream(): Promise<void> {
    if (!isUndefined(this.streamStopFunc)) {
      return Promise.resolve(this.streamStopFunc());
    }

    return Promise.resolve(void 0);
  }
}
