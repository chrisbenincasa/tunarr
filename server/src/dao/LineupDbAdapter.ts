import { Adapter } from 'lowdb';
import { TextFile } from 'lowdb/node';
import { PathLike } from 'node:fs';
import { Lineup, LineupSchema } from './derived_types/Lineup.js';

export class LineupDbAdapter implements Adapter<Lineup> {
  #path: PathLike;
  #adapter: TextFile;
  constructor(filename: PathLike) {
    this.#path = filename;
    this.#adapter = new TextFile(filename);
  }

  async read(): Promise<Lineup | null> {
    const data = await this.#adapter.read();
    if (data === null) {
      return null;
    }
    const parseResult = await LineupSchema.safeParseAsync(JSON.parse(data));
    if (!parseResult.success) {
      console.error(
        `Error while trying to load lineup file ${this.#path.toString()}`,
        parseResult.error,
      );
      return null;
    }
    return parseResult.data;
  }

  async write(data: Lineup): Promise<void> {
    const parseResult = await LineupSchema.safeParseAsync(data);
    if (!parseResult.success) {
      console.warn(
        'Could not parse lineup before saving to DB',
        parseResult.error,
      );
    }

    return this.#adapter.write(JSON.stringify(data));
  }
}
