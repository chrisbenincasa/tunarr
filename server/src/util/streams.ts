import { last } from 'lodash-es';
import type { TransformCallback } from 'node:stream';
import { Transform } from 'node:stream';
import { StringDecoder } from 'node:string_decoder';

export class NewLineTransformStream extends Transform {
  #buffer = '';

  _transform(
    chunk: unknown,
    _: BufferEncoding,
    callback: TransformCallback,
  ): void {
    if (chunk instanceof Buffer) {
      let buffer = this.#buffer + chunk.toString('utf-8');
      if (buffer.indexOf('\n') !== -1) {
        const lines = buffer.split('\n');
        for (const line of lines) {
          this.push(line.trim());
        }
        buffer = last(lines)!;
      }

      this.#buffer = buffer;
    }

    // Pass it along...
    callback();
  }
}

export async function* take<T>(generator: AsyncGenerator<T>, n: number) {
  let c = 0;
  for await (const item of generator) {
    if (c >= n) {
      return;
    }
    yield item;
    c++;
  }
}

/**
 * Replaces every occurrence of `search` in a text stream, including ones split
 * across chunk boundaries. It holds back only the tail of a chunk that could
 * start a match.
 */
export class ReplaceAllTransform extends Transform {
  #carry = '';
  #decoder = new StringDecoder('utf8');

  constructor(
    private readonly search: string,
    private readonly replacement: string,
  ) {
    super({ decodeStrings: false });
    if (search.length === 0) {
      throw new Error('ReplaceAllTransform needs a non-empty search string');
    }
  }

  _transform(
    chunk: unknown,
    _: BufferEncoding,
    callback: TransformCallback,
  ): void {
    const text =
      typeof chunk === 'string'
        ? chunk
        : chunk instanceof Buffer
          ? this.#decoder.write(chunk)
          : String(chunk);
    this.#pushReplaced(this.#carry + text, false);
    callback();
  }

  _flush(callback: TransformCallback): void {
    this.#pushReplaced(this.#carry + this.#decoder.end(), true);
    callback();
  }

  #pushReplaced(text: string, final: boolean) {
    let out = '';
    let from = 0;
    let match = text.indexOf(this.search, from);
    while (match !== -1) {
      out += text.slice(from, match) + this.replacement;
      from = match + this.search.length;
      match = text.indexOf(this.search, from);
    }

    const rest = text.slice(from);
    const keep = final ? 0 : this.#partialMatchLength(rest);
    out += rest.slice(0, rest.length - keep);
    this.#carry = rest.slice(rest.length - keep);
    if (out.length > 0) {
      this.push(out);
    }
  }

  // Length of the longest suffix of `text` that is a proper prefix of `search`.
  #partialMatchLength(text: string) {
    const max = Math.min(text.length, this.search.length - 1);
    for (let len = max; len > 0; len--) {
      if (this.search.startsWith(text.slice(text.length - len))) {
        return len;
      }
    }
    return 0;
  }
}
