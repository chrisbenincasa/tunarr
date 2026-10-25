import type { Nullable } from '@/types/util.js';
import { isProduction } from '@/util/index.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { merge } from 'lodash-es';
import type { Adapter } from 'lowdb';
import fs from 'node:fs/promises';
import type { z } from 'zod/v4';
import { DurableTextFile } from './DurableTextFile.ts';
import type { InvalidJsonPolicy } from './jsonFileContents.ts';
import {
  InvalidJsonFileError,
  corruptFilePath,
  parseJsonFileContents,
} from './jsonFileContents.ts';

export type SchemaBackedDbAdapterOptions = {
  invalidJson?: InvalidJsonPolicy;
  now?: () => number;
  rename?: (from: string, to: string) => Promise<void>;
};

export class SchemaBackedDbAdapter<T extends z.ZodTypeAny>
  implements Adapter<z.output<T>>
{
  private logger = LoggerFactory.child({
    caller: import.meta,
    className: this.constructor.name,
  });

  constructor(
    private schema: T,
    private path: string,
    private defaultValue: Nullable<z.output<T>> = null,
    private adapter: Adapter<string> = new DurableTextFile(path),
    private options: SchemaBackedDbAdapterOptions = {},
  ) {}

  async read(): Promise<z.output<T> | null> {
    // A rejection here means the file exists but could not be read (EACCES,
    // EIO, EMFILE...). It must propagate: treating it as "no data" sends us
    // down the merge-with-defaults path below, which flushes those defaults
    // back to disk and destroys the file we failed to read. Only a genuinely
    // absent file yields null -- DurableTextFile maps ENOENT, and nothing
    // else, to it.
    const contents = parseJsonFileContents(await this.adapter.read());

    if (contents.type === 'empty') {
      this.logger.warn(
        '%s is empty. Treating it as missing and starting from defaults.',
        this.path,
      );
    } else if (contents.type === 'invalid') {
      const policy = this.options.invalidJson ?? 'throw';
      await this.handleInvalidJson(policy, contents.error);

      // The defaults flush below would overwrite the file this policy keeps.
      if (policy === 'ignore') {
        return null;
      }
    }

    if (contents.type !== 'parsed' && this.defaultValue === null) {
      this.logger.debug('Unexpected null data at %s', this.path);
      return null;
    }

    const parsed: unknown = contents.type === 'parsed' ? contents.value : {};
    let parseResult = await this.schema.safeParseAsync(parsed);
    let needsWriteFlush = false;
    let attempts = 0;
    while (!parseResult.success && attempts < 5) {
      if (this.defaultValue !== null) {
        const mergedData = merge({}, this.defaultValue, parsed);
        parseResult = await this.schema.safeParseAsync(mergedData);
        this.logger.debug(
          'Attempting to merge with defaults to obtain valid object',
        );
        needsWriteFlush = parseResult.success;
        attempts++;
        continue;
      }

      this.logger.error(
        parseResult.error,
        `Error while parsing schema-backed JSON file ${this.path}. Returning null. This could mean the DB got corrupted somehow`,
      );
      return null;
    }

    if (!parseResult.success) {
      this.logger.error(
        parseResult.error,
        'Reached max attempts while attempting to remedy invalid config',
      );
      return null;
    }

    if (needsWriteFlush) {
      await this.write(parseResult.data);
    }

    return parseResult.data;
  }

  async write(data: z.output<T>): Promise<void> {
    const parseResult = await this.schema.safeParseAsync(data);
    if (!parseResult.success) {
      this.logger.warn(
        parseResult.error,
        'Could not verify schema before saving to DB - the given type does not match the expected schema.',
      );
      throw new Error(
        'Could not verify schema before saving to DB - the given type does not match the expected schema.',
      );
    }

    return this.adapter.write(
      JSON.stringify(data, undefined, isProduction ? undefined : 4),
    );
  }

  private async handleInvalidJson(policy: InvalidJsonPolicy, error: unknown) {
    switch (policy) {
      case 'throw':
        throw new InvalidJsonFileError(this.path, error);
      case 'ignore':
        this.logger.warn(
          error,
          '%s does not contain valid JSON. Ignoring it and leaving the file in place.',
          this.path,
        );
        return;
      case 'move_aside': {
        const movedTo = corruptFilePath(
          this.path,
          (this.options.now ?? Date.now)(),
        );
        await (this.options.rename ?? fs.rename)(this.path, movedTo);
        this.logger.error(
          error,
          '%s does not contain valid JSON. Moved it to %s and reset its contents to defaults.',
          this.path,
          movedTo,
        );
        return;
      }
    }
  }
}
