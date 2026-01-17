import { v4 } from 'uuid';
import type { NewGenre } from '../schema/Genre.ts';
import type { NewStudio } from '../schema/Studio.ts';
import type { NewTag } from '../schema/Tag.ts';

export class CommonDaoMinter {
  private constructor() {}

  static mintGenre(genreName: string): NewGenre {
    return {
      uuid: v4(),
      name: genreName,
    };
  }

  static mintStudio(studioName: string): NewStudio {
    return {
      uuid: v4(),
      name: studioName,
    };
  }

  static mintTag(tag: string): NewTag {
    return {
      tag,
      uuid: v4(),
    };
  }
}
