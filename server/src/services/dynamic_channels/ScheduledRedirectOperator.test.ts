import dayjs from 'dayjs';
import { initial, last, map, range, reduce } from 'lodash-es';
import { initTestDb } from '../../../tests/testDb';
import { initOrm } from '../../dao/dataSource';
import { Lineup, LineupItem } from '../../dao/derived_types/Lineup';
import { Channel } from '../../dao/entities/Channel';
import { asyncFlow } from '../../util';
import { IntermediateOperator } from './IntermediateOperator';
import { ScheduledRedirectOperator } from './ScheduledRedirectOperator';

beforeAll(async () => {
  await initTestDb();
});

describe('ScheduledRedirectOperator', () => {
  test('test', async () => {
    const em = await initOrm().then(({ em }) => em.fork());
    const start = dayjs().startOf('d').add(2, 'h');
    const channel = em.create(Channel, {
      number: 1,
      guideMinimumDuration: 30,
      name: 'Channel 1',
      duration: 100,
      stealth: false,
      groupTitle: 'tv',
      startTime: start.unix() * 1000,
      disableFillerOverlay: false,
      offline: { mode: 'pic' },
    });

    const channel2 = em.create(Channel, {
      number: 2,
      guideMinimumDuration: 30,
      name: 'Channel 2',
      duration: 100,
      stealth: false,
      groupTitle: 'tv',
      startTime: start.unix() * 1000,
      disableFillerOverlay: false,
      offline: { mode: 'pic' },
    });

    await em.persistAndFlush([channel, channel2]);

    // generate a fake lineup
    const items: LineupItem[] = map(
      range(0, dayjs.duration(2, 'days').asMinutes() / 25),
      (i) => ({
        type: 'content',
        id: `program_${i}`,
        durationMs: dayjs.duration({ minutes: 25 }).asMilliseconds(),
      }),
    );

    const lineup: Lineup = {
      items,
    };

    lineup.startTimeOffsets = reduce(
      lineup.items,
      (acc, item, index) => [...acc, acc[index] + item.durationMs],
      [0],
    );
    channel.duration = last(lineup.startTimeOffsets)!;

    const op = new ScheduledRedirectOperator({
      channelId: channel2.uuid,
      duration: dayjs.duration({ hours: 2 }).asMilliseconds(),
      startHour: 19,
      id: 'scheduled_redirect',
      type: 'modifier',
    });

    const startTime = performance.now();
    const { channel: updatedChannel, lineup: updatedLineup } = await asyncFlow(
      [op, IntermediateOperator],
      {
        channel,
        lineup,
      },
    );
    const end = performance.now();

    initial(updatedLineup.startTimeOffsets)?.forEach((offset, i) =>
      console.log(
        updatedLineup.items[i].type,
        dayjs(updatedChannel.startTime).add(offset).format(),
        i,
      ),
    );

    console.log('Took ' + (end - startTime) + 'ms for 200 days');
  });
});
