import { BaseNfoParser } from './BaseNfoParser.ts';
import { MusicArtistNfoContainer } from './NfoSchemas.ts';

const ArrayTags = [
  'artist.genre',
  'artist.mood',
  'artist.style',
  'artist.thumb',
];

export class MusicArtistNfoParser extends BaseNfoParser<
  typeof MusicArtistNfoContainer
> {
  constructor() {
    super(MusicArtistNfoContainer, { parseTagValue: false });
  }

  protected override get arrayTags() {
    return ArrayTags;
  }
}
