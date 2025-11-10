import { last } from 'lodash-es';
import type { TransformCallback } from 'node:stream';
import { Transform } from 'node:stream';

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
