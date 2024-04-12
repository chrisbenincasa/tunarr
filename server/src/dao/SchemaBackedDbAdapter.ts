import { z } from 'zod';
import { Adapter } from 'lowdb';
import { PathLike } from 'node:fs';
import { TextFile } from 'lowdb/node';
import createLogger from '../logger';

const logger = createLogger(import.meta);

export class SchemaBackedDbAdapter<T extends z.ZodTypeAny, Out = z.infer<T>>
  implements Adapter<Out>
{
  #schema: T;
  #path: PathLike;
  #adapter: TextFile;

  constructor(schema: T, filename: PathLike) {
    this.#schema = schema;
    this.#path = filename;
    this.#adapter = new TextFile(filename);
  }

  async read(): Promise<Out | null> {
    const data = await this.#adapter.read();
    if (data === null) {
      return null;
    }
    const parseResult: z.SafeParseReturnType<unknown, Out> =
      await this.#schema.safeParseAsync(JSON.parse(data));
    if (!parseResult.success) {
      logger.error(
        `Error while parsing schema-backed JSON file ${this.#path.toString()}. Returning null. This could mean the DB got corrupted somehow`,
        parseResult.error,
      );
      return null;
    }
    return parseResult.data as Out | null;
  }

  async write(data: Out): Promise<void> {
    const parseResult = await this.#schema.safeParseAsync(data);
    if (!parseResult.success) {
      logger.warn(
        'Could not verify schema before saving to DB - the given type does not match the expected schema.',
        parseResult.error,
      );
      throw new Error(
        'Could not verify schema before saving to DB - the given type does not match the expected schema.',
      );
    }

    return this.#adapter.write(JSON.stringify(data));
  }
}
