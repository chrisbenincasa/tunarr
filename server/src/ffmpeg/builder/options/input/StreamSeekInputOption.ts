import type { MediaStream } from '@/ffmpeg/builder/MediaStream.js';
import type { InputSource } from '@/ffmpeg/builder/input/InputSource.js';
import type { Duration } from 'dayjs/plugin/duration.js';
import { some } from 'lodash-es';
import { InputOption } from './InputOption.ts';

export class StreamSeekInputOption extends InputOption {
  constructor(private start: Duration) {
    super();
  }

  appliesToInput(input: InputSource<MediaStream>): boolean {
    if (!input.isVideo()) {
      return true;
    }

    return !some(input.streams, (stream) => stream.inputKind === 'stillimage');
  }

  options() {
    return ['-ss', `${this.start.asMilliseconds()}ms`];
  }
}
