import dayjs from 'dayjs';
import { v4 } from 'uuid';
import { createChannel } from '../testing/fakes/entityCreators.ts';
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
            type: 'content',
            id: v4(),
            persisted: true,
            duration: dayjs.duration({ minutes: 22 }).asMilliseconds(),
            subtype: 'episode',
            title: 'Fake',
            externalSourceId: '123',
            externalSourceName: 'name',
            uniqueId: v4(),
            externalSourceType: 'plex',
            externalIds: [],
            externalKey: '123',
            isPaused: false,
            start: 1,
            stop: 2,
            grandparent: {
              title: 'Show',
              type: 'show',
              externalIds: [],
            },
            parent: {
              type: 'season',
              index: 1,
              externalIds: [],
            },
            episodeNumber: 2,
            summary: `The family's trip to Itchy & Scratchy Land takes an unexpected turn when high-tech robots malfunction and become violent.`,
          },
        ],
      },
    ];

    test('escapes summaries', () => {
      const writer = new XmlTvWriter(inMemorySettingsDB());
      const output = writer.generateXmltv(channels);
      expect(output.programmes[0].desc?.[0]._value).includes('&amp;');
    });
  });
});
