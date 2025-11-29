import { BaseNfoParser } from './BaseNfoParser.ts';
import { OtherVideoNfoContainer } from './NfoSchemas.ts';

const ArrayTags = [
  'episodedetails',
  'episodedetails.credits',
  'episodedetails.director',
  'episodedetails.genre',
  'episodedetails.country',
  'episodedetails.thumb',
  'episodedetails.fileinfo',
  'episodedetails.thumb',
  'episodedetails.tag',
  'episodedetails.actor',
  'episodedetails.uniqueid',
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

export class OtherVideoNfoParser extends BaseNfoParser<
  typeof OtherVideoNfoContainer
> {
  constructor() {
    super(OtherVideoNfoContainer, { parseTagValue: false });
  }

  protected override get arrayTags() {
    return ArrayTags;
  }
}
