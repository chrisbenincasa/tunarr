import { merge } from 'lodash-es';
import { Adapter } from 'lowdb';
import { TextFile } from 'lowdb/node';
import { PathLike } from 'node:fs';
import { z } from 'zod';
import { Nullable } from '../types/util';
import { isProduction } from '../util';
import { LoggerFactory } from '../util/logging/LoggerFactory';

export class SchemaBackedDbAdapter<T extends z.ZodTypeAny, Out = z.infer<T>>
  implements Adapter<Out>
{
  private logger = LoggerFactory.child({ caller: import.meta });
  private path: PathLike;
  private adapter: TextFile;

  constructor(
    private schema: T,
    filename: PathLike,
    private defaultValue: Nullable<Out> = null,
  ) {
    this.schema = schema;
    this.path = filename;
    this.adapter = new TextFile(filename);
  }

  async read(): Promise<Out | null> {
    const data = await this.adapter.read();
    if (data === null) {
      return null;
    }
    const parsed: unknown = JSON.parse(data);
    let parseResult: z.SafeParseReturnType<unknown, Out> =
      await this.schema.safeParseAsync(parsed);
    let needsWriteFlush = false;
    while (!parseResult.success) {
      if (this.defaultValue !== null) {
        const mergedData = merge({}, this.defaultValue, parsed);
        parseResult = await this.schema.safeParseAsync(mergedData);
        this.logger.debug(
          'Attempting to merge with defaults to obtain valid object',
        );
        needsWriteFlush = parseResult.success;
        continue;
      }

      this.logger.error(
        `Error while parsing schema-backed JSON file ${this.path.toString()}. Returning null. This could mean the DB got corrupted somehow`,
        parseResult.error,
      );
      return null;
    }

    if (needsWriteFlush) {
      await this.write(parseResult.data);
    }

    return parseResult.data as Out | null;
  }

  async write(data: Out): Promise<void> {
    const parseResult = await this.schema.safeParseAsync(data);
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
