import { type BunFile } from 'bun';
import { isString } from 'lodash-es';
import { type Adapter } from 'lowdb';
import { Buffer } from 'node:buffer';
import { type PathLike } from 'node:fs';
import { LoggerFactory } from '../../util/logging/LoggerFactory.ts';

export class BunFileAdapter implements Adapter<string> {
  private logger = LoggerFactory.child({ className: BunFileAdapter.name });
  private file: BunFile;

  constructor(private path: PathLike) {
    this.file = Bun.file(
      Buffer.isBuffer(path)
        ? path.toString('utf-8')
        : isString(path)
        ? path
        : path.toString(),
    );
  }

  async read(): Promise<string | null> {
    try {
      return this.file.text();
    } catch (e) {
      this.logger.error(e, 'Error reading file at path %s', this.path);
      return null;
    }
  }

  async write(data: string) {
    try {
      await this.file.write(data);
      return;
    } catch (e) {
      this.logger.error(
        e,
        'Failed to write file contents at path: %s',
        this.path,
      );
    }
  }
}
