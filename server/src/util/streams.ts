import { last } from 'lodash-es';
import { Transform, TransformCallback } from 'node:stream';

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
