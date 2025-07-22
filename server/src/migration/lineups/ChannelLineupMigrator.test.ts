import { JSONPath } from 'jsonpath-plus';
import { DeepPartial } from 'ts-essentials';
import { v4 } from 'uuid';
import { Lineup } from '../../db/derived_types/Lineup.ts';
import { uuidRegex } from './SlotShowIdMigration.ts';

describe('ChannelLineupMigrator', () => {
  test('extract version from lineup file', () => {
    const lineup: Partial<Lineup> = {
      version: 1,
    };

    const out = JSONPath({ path: '$.version@number()', json: lineup });
    console.log(out);
  });

  test('select all slots', () => {
    const lineup: DeepPartial<Lineup> = {
      version: 1,
      schedule: {
        type: 'time',
        slots: [
          {
            type: 'movie',
          },
          {
            type: 'show',
            showId: 'Name',
          },
          {
            type: 'show',
            showId: v4(),
          },
          {
            type: 'show',
            showId: 'another name',
          },
        ],
      },
    };

    const out = JSONPath({
      path: `$.schedule.slots[?(@.type === "show" && !@.showId.match(${uuidRegex}))]`,
      json: lineup,
      flatten: true,
      resultType: 'all',
      // callback: (value, _, { parent, parentProperty }) => {
      //   parent[parentProperty]['showId'] = 'Test';
      // },
    });
    console.log(out, lineup);
  });
});
