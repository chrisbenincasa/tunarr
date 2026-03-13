import { v4 } from 'uuid';
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
});
