import { faker } from '@faker-js/faker';
import { v4 } from 'uuid';
import type { Artwork } from '../db/schema/Artwork.ts';
import type { ProgramWithRelationsOrm } from '../db/schema/derivedTypes.ts';
import {
  createChannel,
  createFakeProgram,
} from '../testing/fakes/entityCreators.ts';
import {
  inMemorySettingsDB,
  setTestGlobalOptions,
} from '../testing/getFakeSettingsDb.ts';
import { MaterializedChannelPrograms, XmlTvWriter } from './XmlTvWriter.ts';

beforeAll(async () => {
  await setTestGlobalOptions();
});

function makeArtwork(
  artworkType: Artwork['artworkType'],
  overrides?: Partial<Artwork>,
): Artwork {
  return {
    uuid: v4(),
    sourcePath: faker.internet.url(),
    artworkType,
    cachePath: null,
    blurHash43: null,
    blurHash64: null,
    programId: null,
    groupingId: null,
    creditId: null,
    programExtraId: null,
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

function makeProgram(
  overrides: Partial<ProgramWithRelationsOrm>,
): ProgramWithRelationsOrm {
  return {
    uuid: v4(),
    type: 'movie',
    title: faker.music.songName(),
    duration: faker.number.int({ min: 1000 }),
    sourceType: 'plex',
    canonicalId: null,
    createdAt: null,
    updatedAt: null,
    episode: null,
    externalKey: faker.string.alphanumeric(10),
    externalSourceId: null,
    filePath: null,
    icon: null,
    libraryId: null,
    mediaSourceId: null,
    originalAirDate: null,
    parentExternalKey: null,
    plot: null,
    rating: null,
    seasonNumber: null,
    showTitle: null,
    summary: null,
    year: null,
    albumUuid: null,
    artistUuid: null,
    seasonUuid: null,
    tvShowUuid: null,
    sortTitle: null,
    artistName: null,
    grandparentExternalKey: null,
    ...overrides,
  } as ProgramWithRelationsOrm;
}

describe('XmlTvWriter', () => {
  describe('television', () => {
    const channels: MaterializedChannelPrograms[] = [
      {
        channel: createChannel({
          number: 1,
        }),
        programs: [
          {
            programming: {
              type: 'program',
              program: {
                ...createFakeProgram({
                  summary: `The family's trip to Itchy & Scratchy Land takes an unexpected turn when high-tech robots malfunction and become violent.`,
                }),
                genres: [
                  {
                    genre: { uuid: v4(), name: 'Comedy' },
                    genreId: '',
                    groupId: '',
                    programId: '',
                  },
                  {
                    genre: { uuid: v4(), name: 'Animated' },
                    genreId: '',
                    groupId: '',
                    programId: '',
                  },
                ],
              },
            },
          },
        ],
      },
    ];

    test('escapes summaries', () => {
      const writer = new XmlTvWriter(inMemorySettingsDB());
      const output = writer.generateXmltv(channels);
      expect(output.programmes[0]?.desc?.[0]?._value).includes('&amp;');
    });

    test('adds genres', () => {
      const writer = new XmlTvWriter(inMemorySettingsDB());
      const output = writer.generateXmltv(channels);
      expect(output.programmes[0]?.category?.map((c) => c._value)).toEqual([
        'Comedy',
        'Animated',
      ]);
    });
  });

  describe('resolveArtworkUrl', () => {
    const resolveArtworkUrl = XmlTvWriter.resolveArtworkUrl;

    describe('movies', () => {
      test('returns poster artwork URL when available', () => {
        const programId = v4();
        const program = makeProgram({
          uuid: programId,
          type: 'movie',
          artwork: [makeArtwork('poster')],
        });

        const url = resolveArtworkUrl(program, { useShowPoster: false });
        expect(url).toBe(`{{host}}/api/programs/${programId}/artwork/poster`);
      });

      test('ignores non-poster artwork and falls back to /thumb', () => {
        const programId = v4();
        const program = makeProgram({
          uuid: programId,
          type: 'movie',
          artwork: [makeArtwork('fanart'), makeArtwork('banner')],
        });

        const url = resolveArtworkUrl(program, { useShowPoster: false });
        expect(url).toBe(`{{host}}/api/programs/${programId}/thumb`);
      });

      test('falls back to /thumb when no artwork exists', () => {
        const programId = v4();
        const program = makeProgram({
          uuid: programId,
          type: 'movie',
          artwork: [],
        });

        const url = resolveArtworkUrl(program, { useShowPoster: false });
        expect(url).toBe(`{{host}}/api/programs/${programId}/thumb`);
      });

      test('falls back to /thumb when artwork is undefined', () => {
        const programId = v4();
        const program = makeProgram({
          uuid: programId,
          type: 'movie',
        });

        const url = resolveArtworkUrl(program, { useShowPoster: false });
        expect(url).toBe(`{{host}}/api/programs/${programId}/thumb`);
      });
    });

    describe('episodes', () => {
      test('uses show poster when useShowPoster is true and show has poster', () => {
        const showId = v4();
        const program = makeProgram({
          type: 'episode',
          show: {
            uuid: showId,
            artwork: [makeArtwork('poster')],
          },
          artwork: [makeArtwork('thumbnail')],
        });

        const url = resolveArtworkUrl(program, { useShowPoster: true });
        expect(url).toBe(`{{host}}/api/programs/${showId}/artwork/poster`);
      });

      test('falls back to episode artwork when useShowPoster is true but show has no poster', () => {
        const programId = v4();
        const program = makeProgram({
          uuid: programId,
          type: 'episode',
          show: {
            uuid: v4(),
            artwork: [makeArtwork('fanart')],
          },
          artwork: [makeArtwork('poster')],
        });

        const url = resolveArtworkUrl(program, { useShowPoster: true });
        expect(url).toBe(`{{host}}/api/programs/${programId}/artwork/poster`);
      });

      test('falls back to tvShowUuid when show.uuid is null', () => {
        const tvShowUuid = v4();
        const program = makeProgram({
          type: 'episode',
          tvShowUuid,
          show: {
            uuid: null,
            artwork: [makeArtwork('poster')],
          },
        });

        const url = resolveArtworkUrl(program, { useShowPoster: true });
        expect(url).toBe(`{{host}}/api/programs/${tvShowUuid}/artwork/poster`);
      });

      test('skips show poster when useShowPoster is false', () => {
        const programId = v4();
        const showId = v4();
        const program = makeProgram({
          uuid: programId,
          type: 'episode',
          show: {
            uuid: showId,
            artwork: [makeArtwork('poster')],
          },
          artwork: [makeArtwork('thumbnail')],
        });

        const url = resolveArtworkUrl(program, { useShowPoster: false });
        expect(url).toBe(
          `{{host}}/api/programs/${programId}/artwork/thumbnail`,
        );
      });

      test('uses first matching artwork type (poster or thumbnail)', () => {
        const programId = v4();
        const posterFirst = makeProgram({
          uuid: programId,
          type: 'episode',
          artwork: [makeArtwork('poster'), makeArtwork('thumbnail')],
        });

        expect(resolveArtworkUrl(posterFirst, { useShowPoster: false })).toBe(
          `{{host}}/api/programs/${programId}/artwork/poster`,
        );

        const thumbFirst = makeProgram({
          uuid: programId,
          type: 'episode',
          artwork: [makeArtwork('thumbnail'), makeArtwork('poster')],
        });

        expect(resolveArtworkUrl(thumbFirst, { useShowPoster: false })).toBe(
          `{{host}}/api/programs/${programId}/artwork/thumbnail`,
        );
      });

      test('uses thumbnail when episode has no poster', () => {
        const programId = v4();
        const program = makeProgram({
          uuid: programId,
          type: 'episode',
          artwork: [makeArtwork('thumbnail')],
        });

        const url = resolveArtworkUrl(program, { useShowPoster: false });
        expect(url).toBe(
          `{{host}}/api/programs/${programId}/artwork/thumbnail`,
        );
      });

      test('falls back to /thumb with useShowPoster param when no artwork', () => {
        const programId = v4();
        const program = makeProgram({
          uuid: programId,
          type: 'episode',
          artwork: [],
          show: { uuid: v4(), artwork: [] },
        });

        const url = resolveArtworkUrl(program, { useShowPoster: true });
        expect(url).toBe(
          `{{host}}/api/programs/${programId}/thumb?useShowPoster=true`,
        );
      });

      test('falls back to /thumb without useShowPoster param when setting is false', () => {
        const programId = v4();
        const program = makeProgram({
          uuid: programId,
          type: 'episode',
          artwork: [],
        });

        const url = resolveArtworkUrl(program, { useShowPoster: false });
        expect(url).toBe(`{{host}}/api/programs/${programId}/thumb`);
      });
    });

    describe('tracks', () => {
      test('uses album poster when available', () => {
        const albumId = v4();
        const program = makeProgram({
          type: 'track',
          album: {
            uuid: albumId,
            artwork: [makeArtwork('poster')],
          },
        });

        const url = resolveArtworkUrl(program, { useShowPoster: false });
        expect(url).toBe(`{{host}}/api/programs/${albumId}/artwork/poster`);
      });

      test('falls back to albumUuid when album.uuid is null', () => {
        const albumUuid = v4();
        const program = makeProgram({
          type: 'track',
          albumUuid,
          album: {
            uuid: null,
            artwork: [makeArtwork('poster')],
          },
        });

        const url = resolveArtworkUrl(program, { useShowPoster: false });
        expect(url).toBe(`{{host}}/api/programs/${albumUuid}/artwork/poster`);
      });

      test('falls back to program poster when album has no poster', () => {
        const programId = v4();
        const program = makeProgram({
          uuid: programId,
          type: 'track',
          album: {
            uuid: v4(),
            artwork: [makeArtwork('fanart')],
          },
          artwork: [makeArtwork('poster')],
        });

        const url = resolveArtworkUrl(program, { useShowPoster: false });
        expect(url).toBe(`{{host}}/api/programs/${programId}/artwork/poster`);
      });

      test('falls back to /thumb using album UUID when no artwork', () => {
        const albumUuid = v4();
        const program = makeProgram({
          type: 'track',
          albumUuid,
          album: {
            uuid: albumUuid,
            artwork: [],
          },
          artwork: [],
        });

        const url = resolveArtworkUrl(program, { useShowPoster: false });
        expect(url).toBe(`{{host}}/api/programs/${albumUuid}/thumb`);
      });

      test('falls back to /thumb using program UUID when album has no UUID', () => {
        const programId = v4();
        const program = makeProgram({
          uuid: programId,
          type: 'track',
          album: {
            uuid: null,
            artwork: [],
          },
          artwork: [],
        });

        const url = resolveArtworkUrl(program, { useShowPoster: false });
        expect(url).toBe(`{{host}}/api/programs/${programId}/thumb`);
      });
    });

    describe('music_video and other_video', () => {
      test('music_video uses poster when available', () => {
        const programId = v4();
        const program = makeProgram({
          uuid: programId,
          type: 'music_video',
          artwork: [makeArtwork('poster')],
        });

        const url = resolveArtworkUrl(program, { useShowPoster: false });
        expect(url).toBe(`{{host}}/api/programs/${programId}/artwork/poster`);
      });

      test('other_video falls back to /thumb when no poster', () => {
        const programId = v4();
        const program = makeProgram({
          uuid: programId,
          type: 'other_video',
          artwork: [makeArtwork('thumbnail')],
        });

        const url = resolveArtworkUrl(program, { useShowPoster: false });
        expect(url).toBe(`{{host}}/api/programs/${programId}/thumb`);
      });
    });

    describe('edge cases', () => {
      test('skips candidates with null entity IDs', () => {
        const programId = v4();
        const program = makeProgram({
          uuid: programId,
          type: 'episode',
          tvShowUuid: null,
          show: {
            uuid: null,
            artwork: [makeArtwork('poster')],
          },
          artwork: [makeArtwork('thumbnail')],
        });

        const url = resolveArtworkUrl(program, { useShowPoster: true });
        expect(url).toBe(
          `{{host}}/api/programs/${programId}/artwork/thumbnail`,
        );
      });

      test('skips artwork with null artworkType', () => {
        const programId = v4();
        const program = makeProgram({
          uuid: programId,
          type: 'movie',
          artwork: [
            {
              ...makeArtwork('poster'),
              artworkType: null,
            } as unknown as Artwork,
          ],
        });

        const url = resolveArtworkUrl(program, { useShowPoster: false });
        expect(url).toBe(`{{host}}/api/programs/${programId}/thumb`);
      });
    });
  });
});
