import { LineupItem } from '@/db/derived_types/Lineup.js';
import { map, random, range, sumBy } from 'lodash-es';
import { collapseOfflineTime } from './CollapseOfflineTimeOperator.js';

describe('CollapseOfflineTimeOperator', () => {
  test('collapses offline time', async () => {
    const offlineLineup: LineupItem[] = map(range(0, 5), (i) => ({
      type: 'offline',
      durationMs: random(0, 50, false),
    }));
    const expectedDuration = sumBy(offlineLineup, (l) => l.durationMs);
    const newLineup = await collapseOfflineTime({ items: offlineLineup });
    expect(newLineup.items).toHaveLength(1);
    expect(newLineup.items[0].durationMs).toEqual(expectedDuration);
  });
});
