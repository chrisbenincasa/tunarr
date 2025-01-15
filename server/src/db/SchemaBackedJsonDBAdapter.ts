import { Nullable } from '@/types/util.ts';
import { isProduction } from '@/util/index.ts';
import { LoggerFactory } from '@/util/logging/LoggerFactory.ts';
import { merge } from 'lodash-es';
import { Adapter } from 'lowdb';
import { TextFile } from 'lowdb/node';
import { PathLike } from 'node:fs';
import { z } from 'zod';

export class SchemaBackedDbAdapter<T extends z.ZodTypeAny, Out = z.infer<T>>
  implements Adapter<Out>
{
  private logger = LoggerFactory.child({
    caller: import.meta,
    className: this.constructor.name,
  });
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
    const data = await this.adapter.read().catch((e) => {
      this.logger.error(e);
      return null;
    });
    if (data === null && this.defaultValue === null) {
      this.logger.debug('Unexpected null data at %s; %O', this.path, data);
      return null;
    }

    const parsed: unknown = data ? JSON.parse(data) : {};
    let parseResult: z.SafeParseReturnType<unknown, Out> =
      await this.schema.safeParseAsync(parsed);
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
        `Error while parsing schema-backed JSON file ${this.path.toString()}. Returning null. This could mean the DB got corrupted somehow`,
        parseResult.error,
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

    return parseResult.data as Out | null;
  }

  async write(data: Out): Promise<void> {
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
