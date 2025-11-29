import { BaseNfoParser } from './BaseNfoParser.ts';
import { TvEpisodeNfoContainer } from './NfoSchemas.ts';

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
];

export class TvEpisodeNfoParser extends BaseNfoParser<
  typeof TvEpisodeNfoContainer
> {
  constructor() {
    super(TvEpisodeNfoContainer, { parseTagValue: false });
  }

  protected override get arrayTags() {
    return ArrayTags;
  }
}
