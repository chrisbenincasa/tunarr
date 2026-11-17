import { tag } from '@tunarr/types';
import { describe, expect, test } from 'vitest';
import { createFakeProgramOrm } from '../testing/fakes/entityCreators.js';
import type { MediaSourceId } from '../db/schema/base.js';
import { ApiProgramConverters } from './ApiProgramConverters.js';

describe('ApiProgramConverters.convertProgram with other_video', () => {
  test('includes summary, plot, and tagline from the program row', () => {
    const program = createFakeProgramOrm({
      type: 'other_video',
      sourceType: 'local',
      externalKey: '/media/filler.mkv',
      mediaSourceId: tag<MediaSourceId>('media-source-1'),
      libraryId: 'library-1',
      canonicalId: 'canonical-1',
      summary: 'A local NFO plot',
      plot: 'A movie-style plot',
      tagline: 'A tagline',
    });

    const result = ApiProgramConverters.convertProgram(program, null);

    expect(result).toMatchObject({
      type: 'other_video',
      summary: 'A local NFO plot',
      plot: 'A movie-style plot',
      tagline: 'A tagline',
    });
  });
});
