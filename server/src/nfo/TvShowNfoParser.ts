import { BaseNfoParser } from './BaseNfoParser.ts';
import { TvShowNfoContainer } from './NfoSchemas.ts';

const ArrayTags = [
  'tvshow.credits',
  'tvshow.director',
  'tvshow.genre',
  'tvshow.country',
  'tvshow.fileinfo',
  'tvshow.thumb',
  'tvshow.tag',
  'tvshow.actor',
];

export class TvShowNfoParser extends BaseNfoParser<typeof TvShowNfoContainer> {
  constructor() {
    super(TvShowNfoContainer, { parseTagValue: false });
  }

  protected override get arrayTags() {
    return ArrayTags;
  }
}
