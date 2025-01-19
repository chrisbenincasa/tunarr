import { Nullable } from '@/types/util.js';
import { isProduction } from '@/util/index.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { merge } from 'lodash-es';
import { SyncAdapter } from 'lowdb';
import { TextFileSync } from 'lowdb/node';
import { PathLike } from 'node:fs';
import { z } from 'zod';

export class SyncSchemaBackedDbAdapter<T extends z.ZodTypeAny, Out = z.infer<T>>
  implements SyncAdapter<Out>
{
  private logger = LoggerFactory.child({
    caller: import.meta,
    className: this.constructor.name,
  });
  private path: PathLike;
  private adapter: TextFileSync;

  constructor(
    private schema: T,
    filename: PathLike,
    private defaultValue: Nullable<Out> = null,
  ) {
    this.schema = schema;
    this.path = filename;
    this.adapter = new TextFileSync(filename);
  }

  read(): Nullable<Out> {
    const data = this.adapter.read();
    if (data === null) {
      return null;
    }
    const parsed: unknown = JSON.parse(data);
    let parseResult: z.SafeParseReturnType<unknown, Out> =
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
          return parseResult.data as Out | null;
        }
      }

      if (!parseResult.success) {
        this.logger.error(
          `Error while parsing schema-backed JSON file ${this.path.toString()}. Returning null. This could mean the DB got corrupted somehow`,
          parseResult.error,
        );
        return null;
      }
    }
    return parseResult.data as Out | null;
  }

  write(data: Out): void {
    const parseResult = this.schema.safeParse(data);
    if (!parseResult.success) {
      this.logger.warn(
        'Could not verify schema before saving to DB - the given type does not match the expected schema.',
        parseResult.error,
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
