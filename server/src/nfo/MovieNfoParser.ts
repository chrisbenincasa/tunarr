import { BaseNfoParser } from './BaseNfoParser.ts';
import { MovieNfoContainer } from './NfoSchemas.ts';

const ArrayTags = [
  'movie.credits',
  'movie.director',
  'movie.genre',
  'movie.country',
  'movie.fileinfo',
  'movie.thumb',
  'movie.tag',
  'movie.fileinfo',
  'movie.actor',
];

export class MovieNfoParser extends BaseNfoParser<typeof MovieNfoContainer> {
  constructor() {
    super(MovieNfoContainer, { parseTagValue: false });
  }

  protected override get arrayTags() {
    return ArrayTags;
  }
}
