import { BaseNfoParser } from './BaseNfoParser.ts';
import { MusicVideoNfoContainer } from './NfoSchemas.ts';

const ArrayTags = [
  'musicvideo.artist',
  'musicvideo.thumb',
  'musicvideo.genre',
  'musicvideo.directory',
  'musicvideo.tag',
  'musicvideo.studio',
];

export class MusicVideoNfoParser extends BaseNfoParser<
  typeof MusicVideoNfoContainer
> {
  constructor() {
    super(MusicVideoNfoContainer, { parseTagValue: false });
  }

  protected override get arrayTags() {
    return ArrayTags;
  }
}
