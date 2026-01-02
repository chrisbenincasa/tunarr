import { BaseNfoParser } from './BaseNfoParser.ts';
import { MusicAlbumNfoContainer } from './NfoSchemas.ts';

const ArrayTags = [
  'album.genre',
  'album.mood',
  'album.style',
  'album.theme',
  'album.thumb',
];

export class MusicAlbumNfoParser extends BaseNfoParser<
  typeof MusicAlbumNfoContainer
> {
  constructor() {
    super(MusicAlbumNfoContainer, { parseTagValue: false });
  }

  protected override get arrayTags() {
    return ArrayTags;
  }
}
