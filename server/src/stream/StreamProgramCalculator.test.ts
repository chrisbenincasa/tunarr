import { faker } from '@faker-js/faker';
import { tag } from '@tunarr/types';
import dayjs from 'dayjs';
import { now, sum, sumBy } from 'lodash-es';
import { DeepPartial } from 'ts-essentials';
import { instance, mock, verify, when } from 'ts-mockito';
import { test as baseTest } from 'vitest';
import { Lineup, LineupItem } from '../db/derived_types/Lineup.ts';
import { StreamLineupItem } from '../db/derived_types/StreamLineup.ts';
import { IChannelDB } from '../db/interfaces/IChannelDB.ts';
import { IFillerListDB } from '../db/interfaces/IFillerListDB.ts';
import { IProgramDB } from '../db/interfaces/IProgramDB.ts';
import { calculateStartTimeOffsets } from '../db/lineupUtil.ts';
import { MediaSourceId } from '../db/schema/base.ts';
import { IStreamLineupCache } from '../interfaces/IStreamLineupCache.ts';
import { IFillerPicker } from '../services/interfaces/IFillerPicker.ts';
import {
  createChannel,
  createFakeProgram,
} from '../testing/fakes/entityCreators.ts';
import { LoggerFactory } from '../util/logging/LoggerFactory.ts';
import {
  calculateStreamDuration,
  StreamProgramCalculator,
} from './StreamProgramCalculator.ts';

describe('StreamProgramCalculator', () => {
  baseTest('getCurrentLineupItem simple', async () => {
    const fillerDB = mock<IFillerListDB>();
    const channelDB = mock<IChannelDB>();
    const programDB = mock<IProgramDB>();
    const fillerPicker = mock<IFillerPicker>();
    const channelCache = mock<IStreamLineupCache>();

    const startTime = dayjs(new Date(2025, 8, 17, 8));
    const channelId = faker.string.uuid();
    const programId1 = faker.string.uuid();
    const programId2 = faker.string.uuid();

    const lineup: LineupItem[] = [
      {
        type: 'content',
        durationMs: +dayjs.duration({ minutes: 22 }),
        id: programId1,
      },
      {
        type: 'content',
        durationMs: +dayjs.duration({ minutes: 22 }),
        id: programId2,
      },
    ];

    when(programDB.getProgramById(programId1)).thenReturn(
      Promise.resolve(
        createFakeProgram({
          uuid: programId1,
          duration: lineup[0].durationMs,
          mediaSourceId: tag<MediaSourceId>('mediasource-123'),
        }),
      ),
    );

    when(programDB.getProgramById(programId2)).thenReturn(
      Promise.resolve(
        createFakeProgram({
          uuid: programId2,
          duration: lineup[1].durationMs,
          mediaSourceId: tag<MediaSourceId>('mediasource-123'),
        }),
      ),
    );

    const channel = createChannel({
      uuid: channelId,
      number: 1,
      startTime: +startTime.subtract(1, 'hour'),
      duration: sumBy(lineup, ({ durationMs }) => durationMs),
    });

    when(channelDB.getChannel(1)).thenReturn(Promise.resolve(channel));

    when(channelDB.loadLineup(channelId)).thenReturn(
      Promise.resolve({
        version: 1,
        items: lineup,
        startTimeOffsets: calculateStartTimeOffsets(lineup),
        lastUpdated: now(),
      }),
    );

    const calc = new StreamProgramCalculator(
      LoggerFactory.root,
      instance(fillerDB),
      instance(channelDB),
      instance(channelCache),
      instance(programDB),
      instance(fillerPicker),
    );

    const out = (
      await calc.getCurrentLineupItem({
        allowSkip: false,
        channelId: 1,
        startTime: +startTime,
      })
    ).get();

    expect(out.lineupItem).toMatchObject<DeepPartial<StreamLineupItem>>({
      streamDuration: +dayjs.duration(6, 'minutes'),
      program: {
        uuid: programId1,
      },
      infiniteLoop: false,
      programBeginMs: +startTime - +dayjs.duration(16, 'minutes'),
      startOffset: +dayjs.duration(16, 'minutes'),
    });

    verify(
      channelCache.recordPlayback(channel.uuid, +startTime, out.lineupItem),
    ).once();
  });

  baseTest('getCurrentLineupItem filler lineup item', async () => {
    const fillerDB = mock<IFillerListDB>();
    const channelDB = mock<IChannelDB>();
    const programDB = mock<IProgramDB>();
    const fillerPicker = mock<IFillerPicker>();
    const channelCache = mock<IStreamLineupCache>();

    const startTime = dayjs(new Date(2025, 8, 17, 8));
    const channelId = faker.string.uuid();
    const programId1 = faker.string.uuid();
    const programId2 = faker.string.uuid();
    const fillerListId = faker.string.uuid();

    const lineup: LineupItem[] = [
      {
        type: 'content',
        durationMs: +dayjs.duration({ minutes: 22 }),
        id: programId1,
        fillerListId: fillerListId,
      },
      {
        type: 'content',
        durationMs: +dayjs.duration({ minutes: 22 }),
        id: programId2,
      },
    ];

    when(programDB.getProgramById(programId1)).thenReturn(
      Promise.resolve(
        createFakeProgram({
          uuid: programId1,
          duration: lineup[0].durationMs,
          mediaSourceId: tag<MediaSourceId>('mediasource-123'),
        }),
      ),
    );

    when(programDB.getProgramById(programId2)).thenReturn(
      Promise.resolve(
        createFakeProgram({
          uuid: programId2,
          duration: lineup[1].durationMs,
          mediaSourceId: tag<MediaSourceId>('mediasource-123'),
        }),
      ),
    );

    const channel = createChannel({
      uuid: channelId,
      number: 1,
      startTime: +startTime.subtract(1, 'hour'),
      duration: sumBy(lineup, ({ durationMs }) => durationMs),
    });

    when(channelDB.getChannel(1)).thenReturn(Promise.resolve(channel));

    when(channelDB.loadLineup(channelId)).thenReturn(
      Promise.resolve({
        version: 1,
        items: lineup,
        startTimeOffsets: calculateStartTimeOffsets(lineup),
        lastUpdated: now(),
      }),
    );

    const calc = new StreamProgramCalculator(
      LoggerFactory.root,
      instance(fillerDB),
      instance(channelDB),
      instance(channelCache),
      instance(programDB),
      instance(fillerPicker),
    );

    const out = (
      await calc.getCurrentLineupItem({
        allowSkip: false,
        channelId: 1,
        startTime: +startTime,
      })
    ).get();

    expect(out.lineupItem).toMatchObject<DeepPartial<StreamLineupItem>>({
      streamDuration: +dayjs.duration(6, 'minutes'),
      program: {
        uuid: programId1,
      },
      infiniteLoop: false,
      programBeginMs: +startTime - +dayjs.duration(16, 'minutes'),
      startOffset: +dayjs.duration(16, 'minutes'),
      fillerId: fillerListId,
      type: 'commercial',
    });

    verify(
      channelCache.recordPlayback(channel.uuid, +startTime, out.lineupItem),
    ).once();
  });

  baseTest('getCurrentLineupItem loop filler lineup item', async () => {
    const fillerDB = mock<IFillerListDB>();
    const channelDB = mock<IChannelDB>();
    const programDB = mock<IProgramDB>();
    const fillerPicker = mock<IFillerPicker>();
    const channelCache = mock<IStreamLineupCache>();

    const startTime = dayjs(new Date(2025, 8, 17, 8));
    const channelId = faker.string.uuid();
    const programId1 = faker.string.uuid();
    const programId2 = faker.string.uuid();
    const fillerListId = faker.string.uuid();

    const lineup: LineupItem[] = [
      {
        type: 'content',
        durationMs: +dayjs.duration({ minutes: 22 }),
        id: programId1,
        fillerListId: fillerListId,
      },
      {
        type: 'content',
        durationMs: +dayjs.duration({ minutes: 22 }),
        id: programId2,
      },
    ];

    when(programDB.getProgramById(programId1)).thenReturn(
      Promise.resolve(
        createFakeProgram({
          uuid: programId1,
          duration: +dayjs.duration({ minutes: 2 }),
          mediaSourceId: tag<MediaSourceId>('mediasource-123'),
        }),
      ),
    );

    when(programDB.getProgramById(programId2)).thenReturn(
      Promise.resolve(
        createFakeProgram({
          uuid: programId2,
          duration: lineup[1].durationMs,
          mediaSourceId: tag<MediaSourceId>('mediasource-123'),
        }),
      ),
    );

    const channel = createChannel({
      uuid: channelId,
      number: 1,
      startTime: +startTime.subtract(1, 'hour'),
      duration: sumBy(lineup, ({ durationMs }) => durationMs),
    });

    when(channelDB.getChannel(1)).thenReturn(Promise.resolve(channel));

    when(channelDB.loadLineup(channelId)).thenReturn(
      Promise.resolve({
        version: 1,
        items: lineup,
        startTimeOffsets: calculateStartTimeOffsets(lineup),
        lastUpdated: now(),
      }),
    );

    const calc = new StreamProgramCalculator(
      LoggerFactory.root,
      instance(fillerDB),
      instance(channelDB),
      instance(channelCache),
      instance(programDB),
      instance(fillerPicker),
    );

    const out = (
      await calc.getCurrentLineupItem({
        allowSkip: false,
        channelId: 1,
        startTime: +startTime,
      })
    ).get();

    expect(out.lineupItem).toMatchObject<DeepPartial<StreamLineupItem>>({
      streamDuration: +dayjs.duration(6, 'minutes'),
      program: { uuid: programId1 },
      infiniteLoop: true,
      programBeginMs: +startTime - +dayjs.duration(16, 'minutes'),
      startOffset: +dayjs.duration(16, 'minutes'),
      fillerId: fillerListId,
      type: 'commercial',
      duration: +dayjs.duration(22, 'minutes'),
    });

    verify(
      channelCache.recordPlayback(channel.uuid, +startTime, out.lineupItem),
    ).once();
  });

  describe('calculateStreamDuration', () => {
    test('first channel cycle', () => {
      const lineupItems: LineupItem[] = [
        { type: 'content', id: '1', durationMs: 2000 },
        { type: 'content', id: '2', durationMs: 3000 },
        { type: 'content', id: '3', durationMs: 4000 },
      ];
      const offsets = calculateStartTimeOffsets(lineupItems);
      const lineup: Lineup = {
        version: 1,
        items: lineupItems,
        startTimeOffsets: offsets,
        lastUpdated: now(),
      };
      const duration = sum(lineupItems.map((i) => i.durationMs));
      // we are one "tick" into the 2nd show. there are 2 ticks
      // remaining
      // |--|---|----|
      //     ^
      const { streamDuration } = calculateStreamDuration(
        3000,
        0,
        duration,
        lineup,
        0,
      );
      expect(streamDuration).toEqual(2000);
    });

    test('next channel cycle', () => {
      const lineupItems: LineupItem[] = [
        { type: 'content', id: '1', durationMs: 2000 },
        { type: 'content', id: '2', durationMs: 3000 },
        { type: 'content', id: '3', durationMs: 4000 },
      ];
      const offsets = calculateStartTimeOffsets(lineupItems);
      const lineup: Lineup = {
        version: 1,
        items: lineupItems,
        startTimeOffsets: offsets,
        lastUpdated: now(),
      };
      const duration = sum(lineupItems.map((i) => i.durationMs));
      // we are one "tick" into the 2nd show. there are 2 ticks
      // remaining. the channel has cycled once
      // |--|---|----|
      //     ^
      const { streamDuration } = calculateStreamDuration(
        duration + 3000,
        0,
        duration,
        lineup,
        0,
      );
      expect(streamDuration).toEqual(2000);
    });

    test('loop appropriately on last item', () => {
      const lineupItems: LineupItem[] = [
        { type: 'content', id: '1', durationMs: 2000 },
        { type: 'content', id: '2', durationMs: 3000 },
        { type: 'content', id: '3', durationMs: 4000 },
      ];
      const offsets = calculateStartTimeOffsets(lineupItems);
      const lineup: Lineup = {
        version: 1,
        items: lineupItems,
        startTimeOffsets: offsets,
        lastUpdated: now(),
      };
      const duration = sum(lineupItems.map((i) => i.durationMs));
      // we are one "tick" into the 3rd show. there are 3 ticks
      // remaining in the current program.
      // |--|---|----|
      //         ^
      // The next program (after current finishes) is the first program in the channel
      const { streamDuration } = calculateStreamDuration(
        6_000,
        0,
        duration,
        lineup,
        0,
      );
      expect(streamDuration).toEqual(3000);
    });
  });
});
