import type { Nullable } from '@/types/util.js';
import { isProduction } from '@/util/index.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { merge } from 'lodash-es';
import type { SyncAdapter } from 'lowdb';
import { renameSync } from 'node:fs';
import type { z } from 'zod/v4';
import { DurableTextFileSync } from './DurableTextFile.ts';
import type { InvalidJsonPolicy } from './jsonFileContents.ts';
import {
  InvalidJsonFileError,
  corruptFilePath,
  parseJsonFileContents,
} from './jsonFileContents.ts';

export type SyncSchemaBackedDbAdapterOptions = {
  invalidJson?: InvalidJsonPolicy;
  now?: () => number;
  rename?: (from: string, to: string) => void;
};

export class SyncSchemaBackedDbAdapter<T extends z.ZodTypeAny>
  implements SyncAdapter<z.output<T>>
{
  private logger = LoggerFactory.child({
    caller: import.meta,
    className: this.constructor.name,
  });
  #readFoundNoFile = false;

  constructor(
    private schema: T,
    private path: string,
    private defaultValue: Nullable<z.output<T>> = null,
    private adapter: SyncAdapter<string> = new DurableTextFileSync(path),
    private options: SyncSchemaBackedDbAdapterOptions = {},
  ) {}

  /**
   * True when the last read found no usable file: it was missing, empty, or
   * held invalid JSON that the invalid-JSON policy set aside.
   */
  get readFoundNoFile() {
    return this.#readFoundNoFile;
  }

  read(): Nullable<z.output<T>> {
    // Errors other than ENOENT propagate. See SchemaBackedDbAdapter.read.
    const contents = parseJsonFileContents(this.adapter.read());
    this.#readFoundNoFile = contents.type !== 'parsed';

    switch (contents.type) {
      case 'missing':
        return null;
      case 'empty':
        this.logger.warn(
          '%s is empty. Treating it as missing and starting from defaults.',
          this.path,
        );
        return null;
      case 'invalid':
        this.handleInvalidJson(contents.error);
        return null;
      case 'parsed':
        return this.validate(contents.value);
    }
  }

  write(data: z.output<T>): void {
    const parseResult = this.schema.safeParse(data);
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

  private handleInvalidJson(error: unknown) {
    switch (this.options.invalidJson ?? 'throw') {
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
        (this.options.rename ?? renameSync)(this.path, movedTo);
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

  private validate(parsed: unknown): Nullable<z.output<T>> {
    let parseResult: z.ZodSafeParseResult<z.output<T>> =
      this.schema.safeParse(parsed);
    if (parseResult.success) {
      return parseResult.data;
    }

    if (this.defaultValue !== null) {
      const mergedData = merge({}, this.defaultValue, parsed);
      parseResult = this.schema.safeParse(mergedData);
      this.logger.debug(
        'Attempting to merge with defaults to obtain valid object',
      );

      if (parseResult.success) {
        this.write(mergedData);
        return parseResult.data;
      }
    }

    this.logger.error(
      parseResult.error,
      `Error while parsing schema-backed JSON file ${this.path}. Returning null. This could mean the DB got corrupted somehow`,
    );
    return null;
  }
}
