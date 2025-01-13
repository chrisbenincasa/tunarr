import { MediaStream } from '@/ffmpeg/builder/MediaStream.ts';
import { InputSource } from '@/ffmpeg/builder/input/InputSource.ts';
import { Duration } from 'dayjs/plugin/duration.js';
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
    return ['-ss', `${this.start.asSeconds()}s`];
  }
}
