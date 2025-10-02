import type { Nullable } from '@/types/util.js';
import { isProduction } from '@/util/index.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { merge } from 'lodash-es';
import type { Adapter } from 'lowdb';
import { TextFile } from 'lowdb/node';
import type { PathLike } from 'node:fs';
import type { z } from 'zod/v4';

export class SchemaBackedDbAdapter<T extends z.ZodTypeAny>
  implements Adapter<z.output<T>>
{
  private logger = LoggerFactory.child({
    caller: import.meta,
    className: this.constructor.name,
  });
  private path: PathLike;

  constructor(
    private schema: T,
    filename: PathLike,
    private defaultValue: Nullable<z.output<T>> = null,
    private adapter: Adapter<string> = new TextFile(filename),
  ) {
    this.schema = schema;
    this.path = filename;
    this.adapter = new TextFile(filename);
  }

  async read(): Promise<z.output<T> | null> {
    const data = await this.adapter.read().catch((e) => {
      this.logger.error(e);
      return null;
    });

    if (data === null && this.defaultValue === null) {
      this.logger.debug('Unexpected null data at %s', this.path.toString());
      return null;
    }

    const parsed: unknown = data ? JSON.parse(data) : {};
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
        `Error while parsing schema-backed JSON file ${this.path.toString()}. Returning null. This could mean the DB got corrupted somehow`,
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
      await this.write(parseResult.data as z.output<T>);
    }

    // eslint can't seem to handle this but TS compiler gets it right.
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
}
