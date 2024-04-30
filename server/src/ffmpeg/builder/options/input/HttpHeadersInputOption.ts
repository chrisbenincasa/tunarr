import { isEmpty } from 'lodash-es';
import { MediaStream } from '../../MediaStream.ts';
import { InputSource } from '../../input/InputSource.ts';
import { InputOption } from './InputOption.ts';

export class HttpHeadersInputOption extends InputOption {
  appliesToInput(input: InputSource<MediaStream>): boolean {
    return input.source.type === 'http' && !isEmpty(input.source.extraHeaders);
  }

  options(inputSource: InputSource<MediaStream>): string[] {
    const opts: string[] = [];
    if (inputSource.source.type !== 'http') {
      return opts;
    }

    for (const [key, value] of Object.entries(
      inputSource.source.extraHeaders,
    )) {
      opts.push('-headers', `'${key}: ${value}'`);
    }

    return opts;
  }
}
