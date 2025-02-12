import type { Nullable } from '@/types/util.js';
import { isProduction } from '@/util/index.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { merge } from 'lodash-es';
import type { SyncAdapter } from 'lowdb';
import { TextFileSync } from 'lowdb/node';
import type { PathLike } from 'node:fs';
import type { z } from 'zod/v4';

export class SyncSchemaBackedDbAdapter<T extends z.ZodTypeAny>
  implements SyncAdapter<z.output<T>>
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
    private adapter: SyncAdapter<string> = new TextFileSync(filename),
  ) {
    this.schema = schema;
    this.path = filename;
  }

  read(): Nullable<z.output<T>> {
    const data = this.adapter.read();
    if (data === null) {
      return null;
    }
    const parsed: unknown = JSON.parse(data);
    let parseResult: z.ZodSafeParseResult<z.output<T>> =
      this.schema.safeParse(parsed);
    if (!parseResult.success) {
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

      if (!parseResult.success) {
        this.logger.error(
          parseResult.error,
          `Error while parsing schema-backed JSON file ${this.path.toString()}. Returning null. This could mean the DB got corrupted somehow`,
        );
        return null;
      }
    }
    return parseResult.data;
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
}
