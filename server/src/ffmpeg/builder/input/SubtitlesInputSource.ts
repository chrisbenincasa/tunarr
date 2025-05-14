import type { SubtitleMethod, SubtitleStream } from '../MediaStream.ts';
import type { InputSourceType, StreamSource } from './InputSource.ts';
import { InputSource } from './InputSource.ts';

export class SubtitlesInputSource extends InputSource<SubtitleStream> {
  readonly type: InputSourceType = 'video';

  constructor(
    source: StreamSource,
    public streams: SubtitleStream[],
    public method: SubtitleMethod,
  ) {
    super(source, 'discrete');
  }
}
