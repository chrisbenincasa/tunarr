import { ContentProgram } from '@tunarr/types';
import { test } from 'vitest';
import { ApiProgramMinter } from './ApiProgramMinter.js';

test('ApiProgramMinter mints Plex movies', () => {
  const contentProgram = ApiProgramMinter.mintProgram(
    {
      id: 'mediaSource.123',
      name: 'media source',
    },
    {
      sourceType: 'plex',
      program: {
        type: 'movie',
        originallyAvailableAt: '2001-12-19',
        guid: 'plex://movie/123',
        key: '/library/metadata/123',
        ratingKey: '123',
        title: 'A Great Movie',
        duration: 999,
        Media: [
          {
            id: 1,
            Part: [
              {
                file: '/path/to/test/file',
                id: 1,
                key: '/path/to/file/key.mkv',
              },
            ],
          },
        ],
      },
    },
  );

  expect(contentProgram).toMatchObject({
    type: 'content',
    externalSourceType: 'plex',
    externalSourceName: 'media source',
    date: '2001-12-19',
    duration: 999,
    externalKey: '123',
    title: 'A Great Movie',
    subtype: 'movie',
    externalIds: [
      {
        type: 'multi',
        source: 'plex',
        id: '123',
        sourceId: 'media source',
      },
      {
        type: 'single',
        source: 'plex-guid',
        id: 'plex://movie/123',
      },
    ],
    externalSourceId: 'mediaSource.123',
    persisted: false,
    uniqueId: 'plex|media source|123',
    id: 'plex|media source|123',
    serverFileKey: '/path/to/file/key.mkv',
    serverFilePath: '/path/to/test/file',
  } satisfies ContentProgram);
});
