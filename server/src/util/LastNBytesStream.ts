import stream, { type WritableOptions } from 'stream';

type LastNBytesStreamOpts = WritableOptions & {
  bufSizeBytes?: number;
};
export class LastNBytesStream extends stream.Writable {
  public bufSizeBytes!: number;
  #bytesWritten = 0;
  #buf: Buffer;

  constructor(options?: LastNBytesStreamOpts) {
    super(options);
    this.bufSizeBytes = options?.bufSizeBytes ?? 1024;
    this.#buf = Buffer.alloc(this.bufSizeBytes);
  }

  _write(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    const chunkLength = chunk.length;
    if (chunkLength >= this.bufSizeBytes) {
      // If the chunk is larger than or equal to the buffer, just take the last 1KB
      chunk.copy(this.#buf, 0, chunkLength - this.bufSizeBytes, chunkLength);
      this.#bytesWritten = this.bufSizeBytes;
    } else {
      // If the chunk is smaller, shift existing buffer content and append
      const remainingSpace = this.bufSizeBytes - this.#bytesWritten;

      if (chunkLength <= remainingSpace) {
        // Chunk fits in the remaining space
        chunk.copy(this.#buf, this.#bytesWritten);
        this.#bytesWritten += chunkLength;
      } else {
        // Chunk doesn't fit completely, overwrite from the beginning
        chunk.copy(this.#buf, this.#bytesWritten, 0, remainingSpace);
        chunk.copy(this.#buf, 0, remainingSpace, chunkLength);
        this.#bytesWritten = this.bufSizeBytes;
      }
    }

    callback();
  }

  getLastN() {
    return this.#buf.slice(0, this.#bytesWritten);
  }
}
