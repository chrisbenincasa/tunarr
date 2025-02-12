import { XMLParser } from 'fast-xml-parser';
import * as z4 from 'zod/v4/core';
import { Result } from '../types/result.js';
import type { NfoParser } from './NfoParser.ts';

export abstract class BaseNfoParser<MediaTypeSchema extends z4.$ZodType>
  implements NfoParser<z4.output<MediaTypeSchema>>
{
  protected parser: XMLParser;

  constructor(protected schema: MediaTypeSchema) {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      isArray: (_, jPath) => {
        return this.arrayTags.includes(jPath);
      },
    });
  }

  protected get arrayTags(): string[] {
    return [];
  }

  parse(content: string): Promise<Result<z4.output<MediaTypeSchema>>> {
    const jObj = this.parser.parse(content) as unknown;
    const result = z4.safeParse(this.schema, jObj);

    if (result.error) {
      return Promise.resolve(Result.forError(result.error));
    }

    return Promise.resolve(Result.success(result.data));
  }
}
