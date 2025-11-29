import type { X2jOptions } from 'fast-xml-parser';
import { XMLParser } from 'fast-xml-parser';
import { isNil } from 'lodash-es';
import fs from 'node:fs/promises';
import * as z4 from 'zod/v4/core';
import { Result } from '../types/result.js';
import type { NfoParser } from './NfoParser.ts';

export abstract class BaseNfoParser<MediaTypeSchema extends z4.$ZodType>
  implements NfoParser<z4.output<MediaTypeSchema>>
{
  protected parser: XMLParser;

  constructor(
    protected schema: MediaTypeSchema,
    opts?: X2jOptions,
  ) {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      isArray: (_, jPath) => {
        return this.arrayTags.includes(jPath);
      },
      ...opts,
    });
  }

  protected get arrayTags(): string[] {
    return [];
  }

  async parseFile(
    filename: string,
  ): Promise<Result<z4.output<MediaTypeSchema>>> {
    return (
      await Result.attemptAsync(() => fs.readFile(filename, 'utf-8'))
    ).flatMapAsync((contents) => {
      return this.parse(contents);
    });
  }

  parse(content: string): Promise<Result<z4.output<MediaTypeSchema>>> {
    const jObj = this.parser.parse(content) as unknown;
    if (isNil(jObj)) {
      return Promise.resolve(
        Result.forError(
          new Error(
            'Received null or undefined when trying to parse nfo content.',
          ),
        ),
      );
    }

    const result = z4.safeParse(this.schema, jObj, { reportInput: true });

    if (result.error) {
      return Promise.resolve(Result.failure(z4.prettifyError(result.error)));
    }

    return Promise.resolve(Result.success(result.data));
  }
}
